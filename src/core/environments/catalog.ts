import type { EnvironmentFixture, TaskEnvironment } from '../types'
import { hashString, SeededRandom } from '../utils/random'
import { coreTaskTemplates } from './coreCatalogData'
import { gradeByFactCoverage } from './grading'
import { memoryScenarioTemplates } from './memoryScenarioData'
import type { TaskTemplateData } from './templateTypes'

const pickUniqueFacts = (rng: SeededRandom, facts: string[], count: number): string[] => {
	if (count <= 0 || facts.length === 0) {
		return []
	}
	const pool = [...facts]
	const picks: string[] = []
	while (pool.length > 0 && picks.length < count) {
		const index = rng.int(0, pool.length - 1)
		const [item] = pool.splice(index, 1)
		picks.push(item)
	}
	return picks
}

const buildFixture = (
	template: TaskTemplateData,
	seed: number,
	episode: number,
): EnvironmentFixture => {
	const rng = new SeededRandom(seed ^ hashString(template.id) ^ episode)
	const expectedCount = template.emptyRecall ? 0 : Math.max(1, template.expectedCount ?? 2)
	const expectedFacts = pickUniqueFacts(rng, template.factBank, expectedCount)
	const seedLabel = `${template.id}-${seed}-${episode}`
	const queryHint = expectedFacts.length > 0 ? expectedFacts[0] : 'unknown topic probe'
	const prompt =
		template.queryPrompt ??
		[
			`Task: ${template.name}`,
			`Scenario: ${template.description}`,
			`Objective: ${template.objective.join(', ')}`,
			`Request: produce answer using grounded facts only. Focus query hint: ${queryHint}.`,
		].join('\n')
	return {
		id: `${template.id}:${episode}`,
		seed,
		expectedFacts,
		metadata: {
			...template.metadata,
			sourceTemplate: template.id,
			scenarioPack: template.tags.includes('memory-pack'),
		},
		observation: {
			prompt,
			constraints: [
				'Do not invent memory facts.',
				'Respond concisely with critical details first.',
			],
			seedMessages:
				template.seedMessages && template.seedMessages.length > 0
					? [...template.seedMessages]
					: undefined,
			context: {
				taskId: template.id,
				seedLabel,
				category: template.category,
				expectedFacts,
				tags: template.tags,
				metadata: template.metadata,
			},
		},
	}
}

const buildTask = (template: TaskTemplateData): TaskEnvironment => {
	const memoryFocused = template.memoryFocused ?? template.category === 'memory'
	const llmRubric =
		template.category === 'communication' || template.category === 'research'
			? `Score output 1-10 for ${template.id}. Must be factual, complete, and policy-safe.`
			: undefined

	return {
		id: template.id,
		name: template.name,
		category: template.category,
		description: template.description,
		difficulty: template.difficulty,
		setup: template.setup,
		objective: template.objective,
		scoringDescription: template.scoringDescription,
		reset: template.reset,
		tags: template.tags,
		isMemoryScenario: template.tags.includes('memory-pack'),
		llmRubric,
		fixtureFactory(seed: number, episode: number): EnvironmentFixture {
			return buildFixture(template, seed, episode)
		},
		grade({ fixture, action, durationMs, costUsd }) {
			return gradeByFactCoverage(fixture, action, durationMs, costUsd, memoryFocused)
		},
	}
}

export const coreTasks: TaskEnvironment[] = coreTaskTemplates.map(buildTask)
export const memoryScenarioTasks: TaskEnvironment[] = memoryScenarioTemplates.map(buildTask)

const allTasks = [...coreTasks, ...memoryScenarioTasks]

export const allTaskMap = new Map(allTasks.map((task) => [task.id, task]))

export const getTaskEnvironment = (taskId: string): TaskEnvironment => {
	const task = allTaskMap.get(taskId)
	if (!task) {
		throw new Error(`unknown task '${taskId}'. run 'agentgym tasks list' to inspect IDs.`)
	}
	return task
}

export const listTaskEnvironments = (opts?: {
	includeScenarioPack?: boolean
}): TaskEnvironment[] => {
	if (opts?.includeScenarioPack) {
		return allTasks
	}
	return allTasks.filter((task) => !task.isMemoryScenario)
}

export const listMemoryScenarioTasks = (): TaskEnvironment[] => memoryScenarioTasks
