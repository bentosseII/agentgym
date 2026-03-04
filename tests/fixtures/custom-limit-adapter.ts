import type {
	AdapterConfig,
	AgentAction,
	AgentAdapter,
	EnvObservation,
	EpisodeContext,
	EpisodeSummary,
} from '../../src/core/types'

class CustomLimitAdapter implements AgentAdapter {
	readonly id = 'custom-limit'
	private sleepMs = 0
	private toolCalls = 0
	private includeExpectedFacts = true

	async init(config: AdapterConfig): Promise<void> {
		const metadata = config.metadata ?? {}
		this.sleepMs = Number(metadata.sleepMs ?? 0)
		this.toolCalls = Number(metadata.toolCalls ?? 0)
		this.includeExpectedFacts = Boolean(metadata.includeExpectedFacts ?? true)
	}

	async startEpisode(_ctx: EpisodeContext): Promise<void> {}

	async act(input: EnvObservation): Promise<AgentAction> {
		if (this.sleepMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, this.sleepMs))
		}
		const expectedFacts = Array.isArray(input.context.expectedFacts)
			? (input.context.expectedFacts as string[])
			: []
		const output =
			this.includeExpectedFacts && expectedFacts.length > 0
				? expectedFacts.join('; ')
				: 'insufficient signal'

		return {
			output,
			toolCalls: Array.from({ length: this.toolCalls }, (_, index) => ({
				tool: `tool-${index + 1}`,
			})),
			metadata: {
				usage: {
					total_tokens: Math.max(1, Math.ceil(output.length / 4)),
				},
			},
		}
	}

	async endEpisode(_summary: EpisodeSummary): Promise<void> {}

	async shutdown(): Promise<void> {}
}

export default function createAdapter(): AgentAdapter {
	return new CustomLimitAdapter()
}
