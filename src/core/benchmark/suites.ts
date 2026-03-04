import { coreTasks, listMemoryScenarioTasks } from '../environments'
import type { BenchmarkSuite } from '../types'

const memoryScenarioTaskIds = listMemoryScenarioTasks().map((task) => task.id)

const representativeCoreTaskIds = [
	'memory-pref-1d',
	'memory-composite-reasoning',
	'email-triage-basic',
	'meeting-scheduling',
	'code-bugfix-small',
	'code-pr-review',
	'research-brief',
	'fact-check-claims',
	'plan-execute-5step',
	'api-chaining',
]

const suites: BenchmarkSuite[] = [
	{
		id: 'standard',
		name: 'Standard AgentGym Suite',
		description: 'Cross-category benchmark with representative realistic tasks.',
		taskIds: representativeCoreTaskIds,
		defaultEpisodes: 20,
	},
	{
		id: 'memory',
		name: 'Memory Deep Dive Suite',
		description: '18-scenario memory recall and reasoning stress pack.',
		taskIds: memoryScenarioTaskIds,
		defaultEpisodes: 12,
	},
	{
		id: 'full',
		name: 'Full Core Suite',
		description: 'All 40 core environments across 7 categories.',
		taskIds: coreTasks.map((task) => task.id),
		defaultEpisodes: 8,
	},
]

const suiteMap = new Map(suites.map((suite) => [suite.id, suite]))

export const listSuites = (): BenchmarkSuite[] => suites

export const getSuite = (suiteId: string): BenchmarkSuite => {
	const suite = suiteMap.get(suiteId)
	if (!suite) {
		throw new Error(
			`unknown benchmark suite '${suiteId}'. Available: ${suites.map((item) => item.id).join(', ')}`,
		)
	}
	return suite
}
