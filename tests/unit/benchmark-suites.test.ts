import { describe, expect, test } from 'bun:test'
import { getSuite, listSuites } from '../../src/core/benchmark'

describe('benchmark suites', () => {
	test('exposes standard, memory, and full suites', () => {
		const suites = listSuites().map((suite) => suite.id)
		expect(suites).toContain('standard')
		expect(suites).toContain('memory')
		expect(suites).toContain('full')
	})

	test('memory suite maps to 18 scenario tasks', () => {
		const memory = getSuite('memory')
		expect(memory.taskIds.length).toBe(18)
	})

	test('full suite maps to 40 core tasks', () => {
		const full = getSuite('full')
		expect(full.taskIds.length).toBe(40)
	})
})
