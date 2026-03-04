import type { Command } from 'commander'
import { executeRun, getSuite, listSuites, logInfo, writeJson } from '../core'
import { createRunRequest } from './shared'

interface BenchmarkOptions {
	suite?: string
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
}

export const registerBenchmarkCommand = (program: Command): void => {
	program
		.command('benchmark')
		.description('Run standard benchmark suites')
		.option(
			'--suite <id>',
			`Suite ID (${listSuites()
				.map((suite) => suite.id)
				.join(', ')})`,
			'standard',
		)
		.option('--episodes <n>', 'Episodes per task (default from suite)', (value) => Number(value))
		.option('--seed <n>', 'Base seed', (value) => Number(value), 42)
		.option('--parallel <n>', 'Parallel workers', (value) => Number(value), 1)
		.option('--agent <path>', 'Adapter config YAML path')
		.option('--adapter <id>', 'Built-in adapter ID')
		.option('--custom-adapter <path>', 'Custom adapter module path')
		.option('--enable-llm-judge', 'Enable optional LLM judge')
		.option('--max-episode-ms <n>', 'Per-episode max time in ms', (value) => Number(value), 120000)
		.option('--max-cost-usd <n>', 'Per-episode max cost', (value) => Number(value), 2)
		.option('--max-tool-calls <n>', 'Per-episode max tool calls', (value) => Number(value), 30)
		.option('--no-docker', 'Disable Docker isolation')
		.option('--high-isolation', 'Enable high isolation mode flag', false)
		.option('--run-label <label>', 'Custom run label')
		.action(async (options: BenchmarkOptions) => {
			const suite = getSuite(options.suite ?? 'standard')
			const request = await createRunRequest({
				taskIds: suite.taskIds,
				options: {
					...options,
					episodes: options.episodes ?? suite.defaultEpisodes,
				},
				runLabel: options.runLabel ?? `benchmark:${suite.id}`,
			})
			const result = await executeRun(request, {
				customAdapterModule: options.customAdapter,
			})

			const benchmarkProfile = {
				suite: suite.id,
				runId: result.summary.runId,
				tasks: suite.taskIds.length,
				episodesPerTask: request.episodes,
				overall: result.summary.overall,
				percentileEstimate: Number(
					(Math.min(0.99, 0.55 + result.summary.overall.qualityMean / 20) * 100).toFixed(1),
				),
			}
			const profilePath = `${result.artifacts.rootDir}/benchmark-profile.json`
			await writeJson(profilePath, benchmarkProfile)

			logInfo(`suite: ${suite.id}`)
			logInfo(`run_id: ${result.summary.runId}`)
			logInfo(`quality: ${result.summary.overall.qualityMean.toFixed(3)}/10`)
			logInfo(`success: ${(result.summary.overall.successRate * 100).toFixed(2)}%`)
			logInfo(`reliability: ${(result.summary.overall.reliabilityMean * 100).toFixed(2)}%`)
			logInfo(`percentile_estimate: ${benchmarkProfile.percentileEstimate}`)
			logInfo(`profile: ${profilePath}`)
		})
}
