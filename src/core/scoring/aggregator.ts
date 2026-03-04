import type { DeterministicGrade, ScoreDimensions } from '../types'
import { computeMemoryScore } from './memory'

const fillMemoryDimensions = (
	dimensions: DeterministicGrade['dimensions'],
): ScoreDimensions['memory'] => {
	if (!dimensions) {
		return undefined
	}
	return {
		recallAccuracy: dimensions.recallAccuracy ?? 0,
		contextCompleteness: dimensions.contextCompleteness ?? 0,
		temporalCorrectness: dimensions.temporalCorrectness ?? 0,
		conflictResolution: dimensions.conflictResolution ?? 0,
		precisionSafety: dimensions.precisionSafety ?? 0,
	}
}

export const aggregateEpisodeScore = (
	grade: DeterministicGrade,
	durationMs: number,
	costUsd: number,
	llmJudgeScore?: number,
): ScoreDimensions => {
	const quality =
		typeof llmJudgeScore === 'number'
			? Number((0.8 * grade.quality + 0.2 * llmJudgeScore).toFixed(3))
			: grade.quality
	const metrics: ScoreDimensions = {
		quality,
		taskSuccess: grade.taskSuccess,
		costUsd,
		timeSec: Number((durationMs / 1000).toFixed(3)),
		interventions: grade.interventions,
		reliability: grade.reliability,
	}
	const memory = fillMemoryDimensions(grade.dimensions)
	if (memory) {
		metrics.memory = memory
	}
	return metrics
}

export const maybeComputeMemoryScore = (metrics: ScoreDimensions): number | undefined => {
	if (!metrics.memory) {
		return undefined
	}
	return computeMemoryScore(metrics.memory)
}
