import type {
	AdapterConfig,
	AgentAction,
	AgentAdapter,
	EnvObservation,
	EpisodeContext,
	EpisodeSummary,
} from '../types'

interface OpenAIMessageContentPart {
	type?: string
	text?: string
}

interface OpenAIChatCompletionChoice {
	message?: {
		content?: string | OpenAIMessageContentPart[] | null
	}
}

interface OpenAIChatCompletionResponse {
	choices?: OpenAIChatCompletionChoice[]
	usage?: {
		prompt_tokens?: number
		completion_tokens?: number
		total_tokens?: number
	}
}

interface TokenPricing {
	inputPerMillionUsd: number
	outputPerMillionUsd: number
}

const systemPrompt =
	'You are an AI assistant being evaluated in AgentGym. Follow the task exactly, obey all constraints, and avoid unsupported claims.'

const openAIModelPricing: Record<string, TokenPricing> = {
	'gpt-4o': {
		inputPerMillionUsd: 5,
		outputPerMillionUsd: 15,
	},
	'gpt-4o-mini': {
		inputPerMillionUsd: 0.15,
		outputPerMillionUsd: 0.6,
	},
}

const formatConstraints = (constraints: string[]): string => {
	if (constraints.length === 0) {
		return '- none'
	}
	return constraints.map((constraint, index) => `${index + 1}. ${constraint}`).join('\n')
}

const buildUserPrompt = (input: EnvObservation): string => {
	return [
		`Task:\n${input.prompt}`,
		`Context (JSON):\n${JSON.stringify(input.context, null, 2)}`,
		`Constraints:\n${formatConstraints(input.constraints)}`,
	].join('\n\n')
}

const resolveModelPricing = (model: string): TokenPricing => {
	const exact = openAIModelPricing[model]
	if (exact) {
		return exact
	}
	const prefixed = Object.entries(openAIModelPricing).find(([known]) => model.startsWith(known))
	if (prefixed) {
		return prefixed[1]
	}
	return openAIModelPricing['gpt-4o']
}

const estimateCostUsd = (
	model: string,
	inputTokens: number | undefined,
	outputTokens: number | undefined,
): number | undefined => {
	if (typeof inputTokens !== 'number' || typeof outputTokens !== 'number') {
		return undefined
	}
	const pricing = resolveModelPricing(model)
	const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillionUsd
	const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillionUsd
	return Number((inputCost + outputCost).toFixed(6))
}

const extractMessageText = (
	content: string | OpenAIMessageContentPart[] | null | undefined,
): string | null => {
	if (typeof content === 'string') {
		const trimmed = content.trim()
		return trimmed.length > 0 ? trimmed : null
	}
	if (!Array.isArray(content)) {
		return null
	}
	const text = content
		.filter((part) => part.type === 'text' && typeof part.text === 'string')
		.map((part) => part.text?.trim() ?? '')
		.filter(Boolean)
		.join('\n')
	return text.length > 0 ? text : null
}

const isAbortError = (error: unknown): boolean => {
	return error instanceof Error && error.name === 'AbortError'
}

export class OpenAIAdapter implements AgentAdapter {
	readonly id: string
	private endpoint = 'https://api.openai.com/v1/chat/completions'
	private model = 'gpt-4o'
	private apiKey = ''
	private timeoutMs = 60_000
	private maxTokens = 1024
	private episodeCtx: EpisodeContext | null = null
	private logEpisodeContext = false

	constructor(id = 'openai') {
		this.id = id
	}

	async init(config: AdapterConfig): Promise<void> {
		this.endpoint = config.endpoint ?? this.endpoint
		this.model = config.model ?? this.model
		this.timeoutMs = config.timeoutMs ?? this.timeoutMs
		const configuredMaxTokens = Number(config.metadata?.maxTokens ?? this.maxTokens)
		if (Number.isFinite(configuredMaxTokens) && configuredMaxTokens > 0) {
			this.maxTokens = Math.floor(configuredMaxTokens)
		}
		this.logEpisodeContext = config.metadata?.logEpisodeContext === true

		const envVar = config.apiKeyEnvVar ?? 'OPENAI_API_KEY'
		const key = process.env[envVar]
		if (!key) {
			throw new Error(`adapter ${this.id} missing API key env var ${envVar}`)
		}
		this.apiKey = key
	}

	async startEpisode(ctx: EpisodeContext): Promise<void> {
		this.episodeCtx = ctx
		if (this.logEpisodeContext) {
			console.info(
				`[adapter:${this.id}] run=${ctx.runId} task=${ctx.taskId} episode=${ctx.episode} seed=${ctx.episodeSeed}`,
			)
		}
	}

	async act(input: EnvObservation): Promise<AgentAction> {
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), this.timeoutMs)
		const started = Date.now()
		let response: Response
		try {
			response = await fetch(this.endpoint, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify({
					model: this.model,
					temperature: 0,
					max_tokens: this.maxTokens,
					messages: [
						{
							role: 'system',
							content: systemPrompt,
						},
						{
							role: 'user',
							content: buildUserPrompt(input),
						},
					],
				}),
				signal: controller.signal,
			})
		} catch (error) {
			if (isAbortError(error)) {
				throw new Error(`adapter ${this.id} request timed out after ${this.timeoutMs}ms`)
			}
			throw error
		} finally {
			clearTimeout(timer)
		}

		if (!response.ok) {
			const text = await response.text()
			throw new Error(`adapter ${this.id} request failed: ${response.status} ${text}`)
		}

		const payload = (await response.json()) as OpenAIChatCompletionResponse
		const output = extractMessageText(payload.choices?.[0]?.message?.content)
		if (!output) {
			throw new Error(`adapter ${this.id} returned empty output`)
		}

		const inputTokens = payload.usage?.prompt_tokens
		const outputTokens = payload.usage?.completion_tokens
		const totalTokens =
			payload.usage?.total_tokens ??
			(typeof inputTokens === 'number' && typeof outputTokens === 'number'
				? inputTokens + outputTokens
				: undefined)
		const estimatedCostUsd = estimateCostUsd(this.model, inputTokens, outputTokens)

		return {
			output,
			metadata: {
				provider: 'openai',
				model: this.model,
				durationMs: Date.now() - started,
				estimatedCostUsd,
				episode: this.episodeCtx
					? {
							taskId: this.episodeCtx.taskId,
							episode: this.episodeCtx.episode,
						}
					: undefined,
				usage: {
					input_tokens: inputTokens,
					output_tokens: outputTokens,
					total_tokens: totalTokens,
					prompt_tokens: inputTokens,
					completion_tokens: outputTokens,
				},
			},
		}
	}

	async endEpisode(_summary: EpisodeSummary): Promise<void> {}

	async shutdown(): Promise<void> {
		this.episodeCtx = null
	}
}
