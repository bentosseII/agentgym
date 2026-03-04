import { describe, expect, test } from 'bun:test'
import { pairedMetricAnalysis } from '../../src/core/stats'

describe('pairedMetricAnalysis', () => {
	test('detects clear improvement', () => {
		const result = pairedMetricAnalysis('quality', [6, 6.2, 5.9, 6.1], [7.2, 7.1, 6.9, 7.0])
		expect(result.meanDelta).toBeGreaterThan(0.7)
		expect(result.probabilityImprovement).toBe(1)
		expect(result.pValue).toBeLessThan(0.2)
		expect(result.inconclusive).toBe(false)
	})

	test('cost metric can invert direction', () => {
		const result = pairedMetricAnalysis('costUsd', [0.08, 0.09, 0.07], [0.05, 0.06, 0.06], {
			lowerIsBetter: true,
		})
		expect(result.meanDelta).toBeGreaterThan(0)
	})
})
