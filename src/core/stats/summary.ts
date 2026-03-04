import { computeMemoryScore } from '../scoring/memory'
import type { EpisodeResult, FailureMode, RunSummary, TaskAggregate } from '../types'
import { mean } from '../utils/math'

const allFailureModes: FailureMode[] = [
	'retrieval_miss',
	'hallucinated_fact',
	'planning_error',
	'tool_misuse',
	'policy_violation',
	'timeout_or_cost_overrun',
	'partial_completion',
	'none',
]

const emptyFailureDistribution = (): Record<FailureMode, number> => {
	return Object.fromEntries(allFailureModes.map((key) => [key, 0])) as Record<FailureMode, number>
}

const aggregateEpisodes = (taskId: string, episodes: EpisodeResult[]): TaskAggregate => {
	const failures = emptyFailureDistribution()
	for (const episode of episodes) {
		for (const mode of episode.failureModes) {
			failures[mode] += 1
		}
	}
	const memoryScores = episodes
		.map((episode) =>
			episode.metrics.memory ? computeMemoryScore(episode.metrics.memory) : undefined,
		)
		.filter((value): value is number => typeof value === 'number')

	return {
		taskId,
		episodes: episodes.length,
		successRate: mean(episodes.map((episode) => Number(episode.success))),
		qualityMean: mean(episodes.map((episode) => episode.metrics.quality)),
		taskSuccessMean: mean(episodes.map((episode) => episode.metrics.taskSuccess)),
		costMean: mean(episodes.map((episode) => episode.metrics.costUsd)),
		timeMean: mean(episodes.map((episode) => episode.metrics.timeSec)),
		reliabilityMean: mean(episodes.map((episode) => episode.metrics.reliability)),
		interventionsMean: mean(episodes.map((episode) => episode.metrics.interventions)),
		failureModeDistribution: failures,
		memoryScore: memoryScores.length > 0 ? mean(memoryScores) : undefined,
	}
}

export const buildRunSummary = (input: {
	runId: string
	label: string
	startedAt: string
	endedAt: string
	episodes: EpisodeResult[]
	agent: RunSummary['agent']
	limits: RunSummary['limits']
}): RunSummary => {
	const byTask = new Map<string, EpisodeResult[]>()
	for (const episode of input.episodes) {
		const existing = byTask.get(episode.taskId) ?? []
		existing.push(episode)
		byTask.set(episode.taskId, existing)
	}

	const tasks = [...byTask.entries()].map(([taskId, episodes]) =>
		aggregateEpisodes(taskId, episodes),
	)
	const overall = aggregateEpisodes(
		'overall',
		input.episodes.map((episode) => ({
			...episode,
			taskId: 'overall',
		})),
	)
	return {
		runId: input.runId,
		label: input.label,
		startedAt: input.startedAt,
		endedAt: input.endedAt,
		tasks,
		overall,
		episodeCount: input.episodes.length,
		agent: input.agent,
		limits: input.limits,
	}
}
