import type { MemoryDimensionScores } from '../types'

export const computeMemoryScore = (dimensions: MemoryDimensionScores): number => {
	const score =
		0.35 * dimensions.recallAccuracy +
		0.2 * dimensions.contextCompleteness +
		0.15 * dimensions.temporalCorrectness +
		0.15 * dimensions.conflictResolution +
		0.15 * dimensions.precisionSafety
	return Number(score.toFixed(3))
}
