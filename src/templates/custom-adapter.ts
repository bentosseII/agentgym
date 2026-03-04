import type {
	AdapterConfig,
	AgentAction,
	AgentAdapter,
	EnvObservation,
	EpisodeContext,
	EpisodeSummary,
} from '../src/core/types'

class MyAdapter implements AgentAdapter {
	readonly id = 'my-adapter'

	async init(_config: AdapterConfig): Promise<void> {}

	async startEpisode(_ctx: EpisodeContext): Promise<void> {}

	async act(input: EnvObservation): Promise<AgentAction> {
		return {
			output: `echo:${input.prompt}`,
		}
	}

	async endEpisode(_summary: EpisodeSummary): Promise<void> {}

	async shutdown(): Promise<void> {}
}

export default function createAdapter(): AgentAdapter {
	return new MyAdapter()
}
