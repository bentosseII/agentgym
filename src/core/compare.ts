import { pairedMetricAnalysis } from './stats'
import type { CompareSummary, RunWithArtifacts } from './types'

const metricsToAnalyze = ['quality', 'taskSuccess', 'costUsd', 'timeSec', 'reliability'] as const

const lowerIsBetter = new Set<(typeof metricsToAnalyze)[number]>(['costUsd', 'timeSec'])

const collectMetricValues = (
	episodes: RunWithArtifacts['episodes'],
	taskId: string,
	metric: (typeof metricsToAnalyze)[number],
): number[] => {
	return episodes
		.filter((episode) => episode.taskId === taskId)
		.sort((a, b) => a.episode - b.episode)
		.map((episode) => episode.metrics[metric])
}

export const compareRunOutputs = (input: {
	taskId: string
	episodes: number
	runA: RunWithArtifacts
	runB: RunWithArtifacts
}): CompareSummary => {
	const metrics = metricsToAnalyze.map((metric) => {
		const valuesA = collectMetricValues(input.runA.episodes, input.taskId, metric)
		const valuesB = collectMetricValues(input.runB.episodes, input.taskId, metric)
		return pairedMetricAnalysis(metric, valuesA, valuesB, {
			lowerIsBetter: lowerIsBetter.has(metric),
		})
	})

	const quality = metrics.find((metric) => metric.metric === 'quality')
	const success = metrics.find((metric) => metric.metric === 'taskSuccess')
	let recommendation = 'inconclusive; run more episodes'
	if (quality && success) {
		if (
			!quality.inconclusive &&
			!success.inconclusive &&
			quality.meanDelta > 0 &&
			success.meanDelta > 0
		) {
			recommendation = 'adopt config B'
		} else if (quality.meanDelta < 0 && success.meanDelta < 0) {
			recommendation = 'keep config A'
		}
	}

	return {
		taskId: input.taskId,
		episodes: input.episodes,
		runA: input.runA.summary,
		runB: input.runB.summary,
		metrics,
		recommendation,
	}
}
