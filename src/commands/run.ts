import type { Command } from 'commander'
import { executeRun, logInfo, parseCustomEnvYaml, toTaskEnvironment } from '../core'
import { createRunRequest, parseTaskListArg } from './shared'

interface RunOptions {
	task?: string
	episodes?: number
	seed?: number
	parallel?: number
	agent?: string
	adapter?: string
	enableLlmJudge?: boolean
	maxEpisodeMs?: number
	maxCostUsd?: number
	maxToolCalls?: number
	docker?: boolean
	highIsolation?: boolean
	runLabel?: string
	customAdapter?: string
	env?: string
}

export const registerRunCommand = (program: Command): void => {
	program
		.command('run')
		.description('Run episodes on one or more tasks')
		.requiredOption('--task <task-id[,task-id]>', 'Task ID or comma-separated list')
		.option('--episodes <n>', 'Episode count', (value) => Number(value), 20)
		.option('--seed <n>', 'Base random seed', (value) => Number(value), 42)
		.option('--parallel <n>', 'Parallel workers', (value) => Number(value), 1)
		.option('--agent <path>', 'Adapter config YAML path')
		.option('--adapter <id>', 'Built-in adapter ID override')
		.option('--custom-adapter <path>', 'Custom adapter module path')
		.option('--enable-llm-judge', 'Enable optional LLM rubric scoring')
		.option('--max-episode-ms <n>', 'Per-episode max time in ms', (value) => Number(value), 120000)
		.option('--max-cost-usd <n>', 'Per-episode cost ceiling', (value) => Number(value), 2)
		.option('--max-tool-calls <n>', 'Per-episode tool call cap', (value) => Number(value), 30)
		.option('--no-docker', 'Disable Docker isolation')
		.option('--high-isolation', 'Enable high isolation mode flag', false)
		.option('--run-label <label>', 'Label for this run')
		.option('--env <path>', 'Custom environment YAML path')
		.action(async (options: RunOptions) => {
			const taskIds = parseTaskListArg(options.task)
			const customTasks: Record<string, ReturnType<typeof toTaskEnvironment>> = {}
			if (options.env) {
				const customDef = await parseCustomEnvYaml(options.env)
				const task = toTaskEnvironment(customDef)
				customTasks[task.id] = task
				if (taskIds.length === 1 && taskIds[0] === 'custom') {
					taskIds[0] = task.id
				}
			}
			const request = await createRunRequest({
				taskIds,
				options,
				runLabel: options.runLabel ?? `run:${taskIds.join('+')}`,
			})
			const result = await executeRun(request, {
				customTasks,
				customAdapterModule: options.customAdapter,
			})

			logInfo(`run_id: ${result.summary.runId}`)
			logInfo(`episodes: ${result.summary.episodeCount}`)
			logInfo(`success_rate: ${(result.summary.overall.successRate * 100).toFixed(2)}%`)
			logInfo(`quality: ${result.summary.overall.qualityMean.toFixed(3)}/10`)
			logInfo(`cost_per_episode: $${result.summary.overall.costMean.toFixed(5)}`)
			logInfo(`time_per_episode: ${result.summary.overall.timeMean.toFixed(3)}s`)
			logInfo(`results: ${result.artifacts.resultsPath}`)
			logInfo(`report_md: ${result.artifacts.reportMdPath}`)
			logInfo(`report_html: ${result.artifacts.reportHtmlPath}`)
		})
}
