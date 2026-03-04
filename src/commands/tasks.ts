import type { Command } from 'commander'
import { getTaskEnvironment, listTaskEnvironments, logInfo } from '../core'

interface ListTaskOptions {
	includeScenarioPack?: boolean
	category?: string
}

export const registerTasksCommand = (program: Command): void => {
	const tasks = program.command('tasks').description('Inspect built-in AgentGym tasks')

	tasks
		.command('list')
		.description('List built-in tasks')
		.option('--include-scenario-pack', 'Include memory 18-scenario pack')
		.option('--category <category>', 'Filter by category')
		.action((options: ListTaskOptions) => {
			const all = listTaskEnvironments({
				includeScenarioPack: options.includeScenarioPack ?? false,
			})
			const filtered = options.category
				? all.filter((task) => task.category === options.category)
				: all
			for (const task of filtered) {
				logInfo(`${task.id}\t${task.category}\t${task.difficulty}\t${task.name}`)
			}
			logInfo(`total: ${filtered.length}`)
		})

	tasks
		.command('inspect')
		.description('Inspect task details')
		.argument('<task-id>', 'Task ID')
		.action((taskId: string) => {
			const task = getTaskEnvironment(taskId)
			logInfo(`id: ${task.id}`)
			logInfo(`name: ${task.name}`)
			logInfo(`category: ${task.category}`)
			logInfo(`difficulty: ${task.difficulty}`)
			logInfo(`description: ${task.description}`)
			logInfo(`objective: ${task.objective.join('; ')}`)
			logInfo(`scoring: ${task.scoringDescription}`)
			logInfo(`reset: ${task.reset.mode}${task.reset.target ? ` (${task.reset.target})` : ''}`)
			logInfo(`tags: ${task.tags.join(', ')}`)
			const sampleFixture = task.fixtureFactory(42, 1)
			logInfo(`sample_prompt:\n${sampleFixture.observation.prompt}`)
			logInfo(`sample_expected_facts: ${sampleFixture.expectedFacts.join(' | ') || '(none)'}`)
		})
}
