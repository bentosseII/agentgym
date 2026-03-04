import type {
	AdapterConfig,
	AgentAction,
	AgentAdapter,
	EnvObservation,
	EpisodeContext,
	EpisodeSummary,
} from '../types'
import { hashString, SeededRandom } from '../utils/random'

interface MockAdapterState {
	qualityBias: number
	hallucinationRate: number
}

export class MockAdapter implements AgentAdapter {
	readonly id = 'mock'
	private state: MockAdapterState = {
		qualityBias: 0.75,
		hallucinationRate: 0.05,
	}
	private episodeCtx: EpisodeContext | null = null

	async init(config: AdapterConfig): Promise<void> {
		const qualityBias = Number(config.metadata?.qualityBias ?? 0.75)
		const hallucinationRate = Number(config.metadata?.hallucinationRate ?? 0.05)
		this.state = {
			qualityBias: Math.min(1, Math.max(0, qualityBias)),
			hallucinationRate: Math.min(1, Math.max(0, hallucinationRate)),
		}
	}

	async startEpisode(ctx: EpisodeContext): Promise<void> {
		this.episodeCtx = ctx
	}

	async act(input: EnvObservation): Promise<AgentAction> {
		const episodeSeed = this.episodeCtx?.episodeSeed ?? hashString(input.prompt)
		const rng = new SeededRandom(episodeSeed)
		const confidence = this.state.qualityBias - rng.next() * 0.35
		const hallucinated = rng.next() < this.state.hallucinationRate
		const seedMessages = input.seedMessages?.filter((message) => message.trim().length > 0) ?? []
		const expectedFacts = (input.context.expectedFacts as string[] | undefined) ?? []

		const chosenFacts = expectedFacts.filter(() => rng.next() < this.state.qualityBias)
		const payload = chosenFacts.length > 0 ? chosenFacts.join('; ') : 'insufficient signal'
		const output = hallucinated
			? `${payload}; invented detail: synthetic-fact-${rng.int(100, 999)}`
			: payload

		return {
			output,
			metadata: {
				confidence,
				hallucinated,
				retrievedFacts: chosenFacts.length,
				seedMessagesSeen: seedMessages.length,
			},
		}
	}

	async endEpisode(_summary: EpisodeSummary): Promise<void> {}

	async shutdown(): Promise<void> {
		this.episodeCtx = null
	}
}
