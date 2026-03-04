import { describe, expect, test } from 'bun:test'
import { computeMemoryScore } from '../../src/core/scoring/memory'

describe('memory score', () => {
	test('uses weighted composite formula', () => {
		const score = computeMemoryScore({
			recallAccuracy: 8,
			contextCompleteness: 7,
			temporalCorrectness: 9,
			conflictResolution: 6,
			precisionSafety: 10,
		})
		expect(score).toBeCloseTo(7.95, 2)
	})
})
