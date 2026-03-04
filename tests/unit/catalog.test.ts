import { describe, expect, test } from 'bun:test'
import {
	coreTasks,
	listMemoryScenarioTasks,
	listTaskEnvironments,
} from '../../src/core/environments'

describe('task catalog', () => {
	test('loads 40 core tasks', () => {
		expect(coreTasks.length).toBe(40)
	})

	test('loads 18 memory scenarios', () => {
		expect(listMemoryScenarioTasks().length).toBe(18)
	})

	test('matches spec category distribution', () => {
		const counts = coreTasks.reduce<Record<string, number>>((acc, task) => {
			acc[task.category] = (acc[task.category] ?? 0) + 1
			return acc
		}, {})
		expect(counts.memory).toBe(12)
		expect(counts.communication).toBe(7)
		expect(counts.coding).toBe(6)
		expect(counts.research).toBe(5)
		expect(counts.admin).toBe(4)
		expect(counts['multi-step']).toBe(3)
		expect(counts['tool-use']).toBe(3)
	})

	test('list defaults to core only', () => {
		const listed = listTaskEnvironments()
		expect(listed.length).toBe(40)
	})

	test('list can include memory scenario pack', () => {
		const listed = listTaskEnvironments({ includeScenarioPack: true })
		expect(listed.length).toBe(58)
	})

	test('core memory benchmark tasks include seed messages and explicit recall prompts', () => {
		const expected: Record<string, { prompt: string; seedCount: number }> = {
			'memory-pref-1d': {
				prompt: 'What timezone do I prefer?',
				seedCount: 1,
			},
			'memory-decision-context': {
				prompt:
					'What did we decide about the database for the new project? Include who decided and why.',
				seedCount: 1,
			},
			'memory-similar-items': {
				prompt: "What is Alex's Project Beta about? Don't confuse it with their other project.",
				seedCount: 2,
			},
			'memory-conflict-update': {
				prompt: 'What day do I prefer for meetings?',
				seedCount: 2,
			},
			'memory-negative-recall': {
				prompt: "What's my preferred programming language?",
				seedCount: 1,
			},
			'memory-vague-query': {
				prompt: 'What was decided in that meeting last week?',
				seedCount: 1,
			},
		}

		const taskMap = new Map(coreTasks.map((task) => [task.id, task]))
		for (const [taskId, taskExpectation] of Object.entries(expected)) {
			const task = taskMap.get(taskId)
			expect(task).toBeDefined()
			const fixture = task?.fixtureFactory(42, 1)
			expect(fixture?.observation.prompt).toBe(taskExpectation.prompt)
			expect(fixture?.observation.seedMessages).toHaveLength(taskExpectation.seedCount)
		}
	})
})
