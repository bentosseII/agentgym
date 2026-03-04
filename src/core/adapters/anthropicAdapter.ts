import type {
	AdapterConfig,
	AgentAction,
	AgentAdapter,
	EnvObservation,
	EpisodeContext,
	EpisodeSummary,
} from '../types'

interface AnthropicContentBlock {
	type?: string
	text?: string
}

interface AnthropicMessagesResponse {
	content?: AnthropicContentBlock[]
	usage?: {
		input_tokens?: number
		output_tokens?: number
	}
}

interface TokenPricing {
	inputPerMillionUsd: number
	outputPerMillionUsd: number
}

const systemPrompt =
	'You are an AI assistant being evaluated in AgentGym. Follow the task exactly, obey all constraints, and avoid unsupported claims.'

const anthropicModelPricing: Record<string, TokenPricing> = {
	'claude-sonnet-4-20250514': {
		inputPerMillionUsd: 3,
		outputPerMillionUsd: 15,
	},
	'claude-3-7-sonnet-latest': {
		inputPerMillionUsd: 3,
		outputPerMillionUsd: 15,
	},
	'claude-3-5-sonnet-latest': {
		inputPerMillionUsd: 3,
		outputPerMillionUsd: 15,
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

const buildConversationMessages = (
	input: EnvObservation,
): Array<{ role: 'user' | 'assistant'; content: string }> => {
	const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
	for (const seedMessage of input.seedMessages ?? []) {
		if (seedMessage.trim().length === 0) {
			continue
		}
		messages.push({
			role: 'user',
			content: seedMessage,
		})
	}
	messages.push({
		role: 'user',
		content: buildUserPrompt(input),
	})
	return messages
}

const resolveModelPricing = (model: string): TokenPricing => {
	const exact = anthropicModelPricing[model]
	if (exact) {
		return exact
	}
	const prefixed = Object.entries(anthropicModelPricing).find(([known]) => model.startsWith(known))
	if (prefixed) {
		return prefixed[1]
	}
	return anthropicModelPricing['claude-sonnet-4-20250514']
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

const isAbortError = (error: unknown): boolean => {
	return error instanceof Error && error.name === 'AbortError'
}

export class AnthropicAdapter implements AgentAdapter {
	readonly id: string
	private endpoint = 'https://api.anthropic.com/v1/messages'
	private model = 'claude-sonnet-4-20250514'
	private apiKey = ''
	private timeoutMs = 60_000
	private maxTokens = 1024
	private episodeCtx: EpisodeContext | null = null
	private logEpisodeContext = false

	constructor(id = 'anthropic') {
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

		const envVar = config.apiKeyEnvVar ?? 'ANTHROPIC_API_KEY'
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
					'x-api-key': this.apiKey,
					'anthropic-version': '2023-06-01',
				},
				body: JSON.stringify({
					model: this.model,
					max_tokens: this.maxTokens,
					temperature: 0,
					system: systemPrompt,
					messages: buildConversationMessages(input),
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

		const payload = (await response.json()) as AnthropicMessagesResponse
		const output = payload.content
			?.filter((entry) => entry.type === 'text' && typeof entry.text === 'string')
			.map((entry) => entry.text?.trim() ?? '')
			.filter(Boolean)
			.join('\n')

		if (!output) {
			throw new Error(`adapter ${this.id} returned empty output`)
		}

		const inputTokens = payload.usage?.input_tokens
		const outputTokens = payload.usage?.output_tokens
		const totalTokens =
			typeof inputTokens === 'number' && typeof outputTokens === 'number'
				? inputTokens + outputTokens
				: undefined
		const estimatedCostUsd = estimateCostUsd(this.model, inputTokens, outputTokens)

		return {
			output,
			metadata: {
				provider: 'anthropic',
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
				},
			},
		}
	}

	async endEpisode(_summary: EpisodeSummary): Promise<void> {}

	async shutdown(): Promise<void> {
		this.episodeCtx = null
	}
}
