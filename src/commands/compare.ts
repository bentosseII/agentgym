import path from 'node:path'
import type { Command } from 'commander'
import { compareRunOutputs, executeRun, logInfo, parseAdapterConfig, writeJson } from '../core'
import { parseRunLimits, parseRuntimeOptions } from './shared'

interface CompareOptions {
	task?: string
	episodes?: number
	seed?: number
	parallel?: number
	configA?: string
	configB?: string
	maxEpisodeMs?: number
	maxCostUsd?: number
	maxToolCalls?: number
	enableLlmJudge?: boolean
	docker?: boolean
	highIsolation?: boolean
	customAdapterA?: string
	customAdapterB?: string
}

export const registerCompareCommand = (program: Command): void => {
	program
		.command('compare')
		.description('Run paired A/B comparison with significance testing')
		.requiredOption('--task <task-id>', 'Task ID to compare on')
		.requiredOption('--config-a <path>', 'Adapter config A YAML')
		.requiredOption('--config-b <path>', 'Adapter config B YAML')
		.option('--custom-adapter-a <path>', 'Custom adapter module for A')
		.option('--custom-adapter-b <path>', 'Custom adapter module for B')
		.option('--episodes <n>', 'Episode count', (value) => Number(value), 40)
		.option('--seed <n>', 'Seed for paired episodes', (value) => Number(value), 123)
		.option('--parallel <n>', 'Parallel workers', (value) => Number(value), 1)
		.option('--enable-llm-judge', 'Enable LLM rubric scoring')
		.option('--max-episode-ms <n>', 'Per-episode max time in ms', (value) => Number(value), 120000)
		.option('--max-cost-usd <n>', 'Per-episode max cost', (value) => Number(value), 2)
		.option('--max-tool-calls <n>', 'Per-episode max tool calls', (value) => Number(value), 30)
		.option('--no-docker', 'Disable Docker isolation')
		.option('--high-isolation', 'Enable high isolation mode flag', false)
		.action(async (options: CompareOptions) => {
			const taskId = options.task ?? ''
			const configAPath = options.configA ?? ''
			const configBPath = options.configB ?? ''
			const adapterA = await parseAdapterConfig(path.resolve(process.cwd(), configAPath))
			const adapterB = await parseAdapterConfig(path.resolve(process.cwd(), configBPath))
			const baseRequest = {
				taskIds: [taskId],
				episodes: Math.max(1, options.episodes ?? 40),
				seed: options.seed ?? 123,
				parallelism: Math.max(1, options.parallel ?? 1),
				runtime: parseRuntimeOptions(options),
				limits: parseRunLimits(options),
				enableLLMJudge: options.enableLlmJudge ?? false,
			}

			const runA = await executeRun(
				{
					...baseRequest,
					runLabel: `compare-A:${taskId}`,
					agentConfig: adapterA,
				},
				{
					customAdapterModule: options.customAdapterA,
				},
			)
			const runB = await executeRun(
				{
					...baseRequest,
					runLabel: `compare-B:${taskId}`,
					agentConfig: adapterB,
				},
				{
					customAdapterModule: options.customAdapterB,
				},
			)

			const comparison = compareRunOutputs({
				taskId,
				episodes: baseRequest.episodes,
				runA,
				runB,
			})
			const comparePath = path.resolve(
				process.cwd(),
				'runs',
				`${comparison.runB.runId}-compare.json`,
			)
			await writeJson(comparePath, comparison)

			logInfo(`task: ${taskId}`)
			for (const metric of comparison.metrics) {
				logInfo(
					`${metric.metric}: delta=${metric.meanDelta.toFixed(4)} effect=${metric.effectSize.toFixed(3)} p=${metric.pValue.toFixed(4)} ci=[${metric.ci95[0].toFixed(4)}, ${metric.ci95[1].toFixed(4)}] improve=${(metric.probabilityImprovement * 100).toFixed(1)}% ${metric.inconclusive ? 'INCONCLUSIVE' : ''}`,
				)
			}
			logInfo(`recommendation: ${comparison.recommendation}`)
			logInfo(`compare_artifact: ${comparePath}`)
		})
}
