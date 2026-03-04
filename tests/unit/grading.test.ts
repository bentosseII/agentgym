import { describe, expect, test } from 'bun:test'
import { gradeByFactCoverage } from '../../src/core/environments/grading'
import type { EnvironmentFixture } from '../../src/core/types'

const fixtureWithFacts: EnvironmentFixture = {
	id: 'fixture-1',
	seed: 1,
	expectedFacts: ['fact alpha', 'fact beta'],
	observation: {
		prompt: 'test prompt',
		context: {},
		constraints: [],
	},
}

describe('gradeByFactCoverage', () => {
	test('scores high when all expected facts present', () => {
		const result = gradeByFactCoverage(
			fixtureWithFacts,
			{ output: 'fact alpha; fact beta' },
			1000,
			0.01,
			true,
		)
		expect(result.success).toBe(true)
		expect(result.failureModes).toEqual(['none'])
		expect(result.dimensions?.recallAccuracy).toBe(10)
	})

	test('penalizes hallucinated details', () => {
		const result = gradeByFactCoverage(
			fixtureWithFacts,
			{ output: 'fact alpha; invented detail: synthetic-fact-123' },
			1000,
			0.01,
			true,
		)
		expect(result.success).toBe(false)
		expect(result.failureModes).toContain('hallucinated_fact')
		expect(result.dimensions?.precisionSafety).toBeLessThan(5)
	})

	test('handles negative recall tasks safely', () => {
		const emptyFixture: EnvironmentFixture = {
			...fixtureWithFacts,
			id: 'fixture-empty',
			expectedFacts: [],
		}
		const result = gradeByFactCoverage(
			emptyFixture,
			{ output: 'unknown, no memory for this topic' },
			500,
			0.001,
			true,
		)
		expect(result.success).toBe(true)
		expect(result.taskSuccess).toBe(1)
		expect(result.failureModes).toEqual(['none'])
	})
})
