import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Command } from 'commander'
import YAML from 'yaml'
import { z } from 'zod'
import { type CiSuiteDefinition, executeRun, logError, logInfo, type TaskAggregate } from '../core'
import { parseRunLimits, parseRuntimeOptions, resolveAgentConfig } from './shared'

const ciSuiteSchema = z.object({
	name: z.string().min(1),
	seed: z.number().int().optional(),
	tasks: z
		.array(
			z.object({
				id: z.string().min(1),
				episodes: z.number().int().positive(),
			}),
		)
		.min(1),
	thresholds: z.object({
		quality: z.number().optional(),
		successRate: z.number().optional(),
		reliability: z.number().optional(),
		maxCostUsd: z.number().optional(),
		maxTimeSec: z.number().optional(),
	}),
})

interface CiOptions {
	suite?: string
	threshold?: number
	agent?: string
	adapter?: string
	parallel?: number
	maxEpisodeMs?: number
	maxCostUsd?: number
	maxToolCalls?: number
	enableLlmJudge?: boolean
	docker?: boolean
	highIsolation?: boolean
	customAdapter?: string
}

const loadSuite = async (suitePath: string): Promise<CiSuiteDefinition> => {
	const resolved = path.resolve(process.cwd(), suitePath)
	const raw = await readFile(resolved, 'utf-8')
	const parsed = YAML.parse(raw)
	const result = ciSuiteSchema.safeParse(parsed)
	if (!result.success) {
		throw new Error(`invalid CI suite ${suitePath}: ${result.error.message}`)
	}
	return result.data
}

const weightedMean = (values: Array<{ value: number; weight: number }>): number => {
	const totalWeight = values.reduce((sum, item) => sum + item.weight, 0)
	if (totalWeight === 0) {
		return 0
	}
	const weighted = values.reduce((sum, item) => sum + item.value * item.weight, 0)
	return weighted / totalWeight
}

const aggregate = (tasks: TaskAggregate[]) => ({
	quality: weightedMean(tasks.map((task) => ({ value: task.qualityMean, weight: task.episodes }))),
	successRate: weightedMean(
		tasks.map((task) => ({ value: task.successRate, weight: task.episodes })),
	),
	reliability: weightedMean(
		tasks.map((task) => ({ value: task.reliabilityMean, weight: task.episodes })),
	),
	cost: weightedMean(tasks.map((task) => ({ value: task.costMean, weight: task.episodes }))),
	time: weightedMean(tasks.map((task) => ({ value: task.timeMean, weight: task.episodes }))),
})

export const registerCiCommand = (program: Command): void => {
	program
		.command('ci')
		.description('Run regression suite and enforce quality gates')
		.requiredOption('--suite <path>', 'CI suite YAML path')
		.option('--threshold <n>', 'Override minimum quality threshold', (value) => Number(value))
		.option('--agent <path>', 'Adapter config YAML path')
		.option('--adapter <id>', 'Built-in adapter ID')
		.option('--custom-adapter <path>', 'Custom adapter module path')
		.option('--parallel <n>', 'Parallel workers', (value) => Number(value), 1)
		.option('--enable-llm-judge', 'Enable optional LLM judge')
		.option('--max-episode-ms <n>', 'Per-episode max time in ms', (value) => Number(value), 120000)
		.option('--max-cost-usd <n>', 'Per-episode max cost', (value) => Number(value), 2)
		.option('--max-tool-calls <n>', 'Per-episode max tool calls', (value) => Number(value), 30)
		.option('--no-docker', 'Disable Docker isolation')
		.option('--high-isolation', 'Enable high isolation mode flag', false)
		.action(async (options: CiOptions) => {
			const suite = await loadSuite(options.suite ?? '')
			const agent = await resolveAgentConfig(options)
			const taskAggregates: TaskAggregate[] = []
			const baseSeed = suite.seed ?? 2026
			for (const [index, task] of suite.tasks.entries()) {
				const run = await executeRun(
					{
						runLabel: `ci:${suite.name}:${task.id}`,
						taskIds: [task.id],
						episodes: task.episodes,
						seed: baseSeed + index,
						parallelism: Math.max(1, options.parallel ?? 1),
						agentConfig: agent,
						runtime: parseRuntimeOptions(options),
						limits: parseRunLimits(options),
						enableLLMJudge: options.enableLlmJudge ?? false,
					},
					{
						customAdapterModule: options.customAdapter,
					},
				)
				taskAggregates.push(...run.summary.tasks)
				logInfo(
					`task ${task.id}: quality=${run.summary.overall.qualityMean.toFixed(3)} success=${(run.summary.overall.successRate * 100).toFixed(1)}% reliability=${(run.summary.overall.reliabilityMean * 100).toFixed(1)}%`,
				)
			}

			const summary = aggregate(taskAggregates)
			const thresholds = {
				...suite.thresholds,
				quality: options.threshold ?? suite.thresholds.quality,
			}

			const failures: string[] = []
			if (typeof thresholds.quality === 'number' && summary.quality < thresholds.quality) {
				failures.push(`quality ${summary.quality.toFixed(3)} < ${thresholds.quality}`)
			}
			if (
				typeof thresholds.successRate === 'number' &&
				summary.successRate < thresholds.successRate
			) {
				failures.push(
					`successRate ${(summary.successRate * 100).toFixed(2)}% < ${(thresholds.successRate * 100).toFixed(2)}%`,
				)
			}
			if (
				typeof thresholds.reliability === 'number' &&
				summary.reliability < thresholds.reliability
			) {
				failures.push(
					`reliability ${(summary.reliability * 100).toFixed(2)}% < ${(thresholds.reliability * 100).toFixed(2)}%`,
				)
			}
			if (typeof thresholds.maxCostUsd === 'number' && summary.cost > thresholds.maxCostUsd) {
				failures.push(`cost ${summary.cost.toFixed(5)} > ${thresholds.maxCostUsd}`)
			}
			if (typeof thresholds.maxTimeSec === 'number' && summary.time > thresholds.maxTimeSec) {
				failures.push(`time ${summary.time.toFixed(3)}s > ${thresholds.maxTimeSec}s`)
			}

			logInfo(
				`ci_summary quality=${summary.quality.toFixed(3)} success=${(summary.successRate * 100).toFixed(2)}% reliability=${(summary.reliability * 100).toFixed(2)}% cost=${summary.cost.toFixed(5)} time=${summary.time.toFixed(3)}s`,
			)
			if (failures.length > 0) {
				logError('ci_gate: FAIL')
				for (const failure of failures) {
					logError(`- ${failure}`)
				}
				process.exitCode = 1
				return
			}
			logInfo('ci_gate: PASS')
		})
}
