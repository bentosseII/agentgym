import type {
	AdapterConfig,
	AgentAction,
	AgentAdapter,
	EnvObservation,
	EpisodeContext,
	EpisodeSummary,
} from '../types'

interface ChatCompletionChoice {
	message?: {
		content?: string
	}
}

interface ChatCompletionResponse {
	choices?: ChatCompletionChoice[]
	usage?: {
		prompt_tokens?: number
		completion_tokens?: number
		total_tokens?: number
	}
}

export class OpenAICompatibleAdapter implements AgentAdapter {
	readonly id: string
	private endpoint = 'https://api.openai.com/v1/chat/completions'
	private model = 'gpt-4o-mini'
	private apiKey = ''

	constructor(id = 'raw-api') {
		this.id = id
	}

	async init(config: AdapterConfig): Promise<void> {
		this.endpoint = config.endpoint ?? this.endpoint
		this.model = config.model ?? this.model
		const envVar = config.apiKeyEnvVar ?? 'OPENAI_API_KEY'
		const key = process.env[envVar]
		if (!key) {
			throw new Error(`adapter ${this.id} missing API key env var ${envVar}`)
		}
		this.apiKey = key
	}

	async startEpisode(_ctx: EpisodeContext): Promise<void> {}

	async act(input: EnvObservation): Promise<AgentAction> {
		const response = await fetch(this.endpoint, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				model: this.model,
				messages: [
					{
						role: 'system',
						content: 'You are an agent executing benchmark tasks safely and accurately.',
					},
					{
						role: 'user',
						content: `${input.prompt}\n\nContext:\n${JSON.stringify(input.context, null, 2)}`,
					},
				],
				temperature: 0,
			}),
		})

		if (!response.ok) {
			const text = await response.text()
			throw new Error(`adapter ${this.id} request failed: ${response.status} ${text}`)
		}

		const payload = (await response.json()) as ChatCompletionResponse
		const output = payload.choices?.[0]?.message?.content?.trim()
		if (!output) {
			throw new Error(`adapter ${this.id} returned empty output`)
		}

		return {
			output,
			metadata: {
				usage: payload.usage,
			},
		}
	}

	async endEpisode(_summary: EpisodeSummary): Promise<void> {}

	async shutdown(): Promise<void> {}
}
