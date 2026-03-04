import { createAdapter } from '../adapters'
import { prepareArtifacts, writeRunArtifacts } from '../artifacts'
import { getTaskEnvironment } from '../environments'
import { aggregateEpisodeScore, LLMJudge } from '../scoring'
import { buildRunSummary } from '../stats'
import type {
	AdapterConfig,
	AgentAction,
	DeterministicGrade,
	EpisodeResult,
	EpisodeTraceEvent,
	RunRequest,
	RunWithArtifacts,
	TaskEnvironment,
} from '../types'
import { makeRunId } from '../utils/id'
import { hashString } from '../utils/random'
import { nowIso } from '../utils/time'
import { DockerEnvironmentRuntime } from './dockerRuntime'

const estimateCostUsd = (action: {
	output: string
	metadata?: Record<string, unknown>
}): number => {
	const usage = action.metadata?.usage as { total_tokens?: number } | undefined
	if (typeof usage?.total_tokens === 'number') {
		return Number((usage.total_tokens * 0.00001).toFixed(6))
	}
	const charLength = action.output.length
	const estimatedTokens = Math.max(1, Math.ceil(charLength / 4))
	return Number((estimatedTokens * 0.00001).toFixed(6))
}

const uniqueFailureModes = (
	modes: Array<DeterministicGrade['failureModes'][number] | ''>,
): DeterministicGrade['failureModes'] =>
	[...new Set(modes.filter(Boolean))] as DeterministicGrade['failureModes']

const applyRunLimits = (input: {
	deterministic: DeterministicGrade
	actionOutput: AgentAction
	durationMs: number
	costUsd: number
	request: RunRequest
}): DeterministicGrade => {
	const breaches: string[] = []
	if (input.durationMs > input.request.limits.maxEpisodeMs) {
		breaches.push('maxEpisodeMs')
	}
	if (input.costUsd > input.request.limits.maxCostUsd) {
		breaches.push('maxCostUsd')
	}
	const toolCalls = input.actionOutput.toolCalls?.length ?? 0
	if (toolCalls > input.request.limits.maxToolCalls) {
		breaches.push('maxToolCalls')
	}
	if (breaches.length === 0) {
		return input.deterministic
	}
	return {
		...input.deterministic,
		success: false,
		quality: Number(Math.max(0, input.deterministic.quality - 2.5).toFixed(3)),
		taskSuccess: Number(Math.max(0, input.deterministic.taskSuccess - 0.2).toFixed(3)),
		reliability: Number(Math.min(input.deterministic.reliability, 0.4).toFixed(3)),
		interventions: input.deterministic.interventions + breaches.length,
		failureModes: uniqueFailureModes([
			...input.deterministic.failureModes.filter((mode) => mode !== 'none'),
			breaches.includes('maxToolCalls') ? 'tool_misuse' : '',
			breaches.includes('maxEpisodeMs') || breaches.includes('maxCostUsd')
				? 'timeout_or_cost_overrun'
				: '',
			'partial_completion',
		]),
		details: {
			...(input.deterministic.details ?? {}),
			limitsBreached: breaches,
			toolCalls,
			limits: input.request.limits,
		},
	}
}

const runEpisode = async (input: {
	runId: string
	runLabel: string
	task: TaskEnvironment
	episode: number
	episodeSeed: number
	adapter: Awaited<ReturnType<typeof createAdapter>>
	runtime: DockerEnvironmentRuntime
	request: RunRequest
	llmJudge: LLMJudge
}): Promise<EpisodeResult> => {
	const fixture = input.task.fixtureFactory(input.episodeSeed, input.episode)
	const trace: EpisodeTraceEvent[] = []
	await input.runtime.setupEpisode(input.task, fixture)
	trace.push({
		timestamp: nowIso(),
		kind: 'runtime',
		payload: {
			event: 'setup',
			taskId: input.task.id,
			fixtureId: fixture.id,
			dockerAvailable: input.runtime.dockerAvailable,
		},
	})

	await input.adapter.startEpisode({
		runId: input.runId,
		runLabel: input.runLabel,
		taskId: input.task.id,
		episode: input.episode,
		episodeSeed: input.episodeSeed,
		startedAt: nowIso(),
		limits: input.request.limits,
	})

	trace.push({
		timestamp: nowIso(),
		kind: 'observation',
		payload: {
			prompt: fixture.observation.prompt,
			context: fixture.observation.context,
			constraints: fixture.observation.constraints,
		},
	})

	let actionOutput: AgentAction = {
		output: 'agent failed before output',
		metadata: {
			error: 'unknown',
		},
	}
	let deterministic = input.task.grade({
		fixture,
		action: actionOutput,
		durationMs: input.request.limits.maxEpisodeMs,
		costUsd: input.request.limits.maxCostUsd,
	})
	let durationMs = 0
	let costUsd = 0
	try {
		const started = Date.now()
		const timeoutMs = input.request.limits.maxEpisodeMs
		let timer: ReturnType<typeof setTimeout> | undefined
		const timeoutPromise = new Promise<never>((_, reject) => {
			timer = setTimeout(() => {
				reject(new Error(`episode timed out after ${timeoutMs}ms`))
			}, timeoutMs)
		})
		try {
			actionOutput = await Promise.race([input.adapter.act(fixture.observation), timeoutPromise])
		} finally {
			if (timer) {
				clearTimeout(timer)
			}
		}
		durationMs = Date.now() - started
		costUsd = estimateCostUsd(actionOutput)
		deterministic = input.task.grade({
			fixture,
			action: actionOutput,
			durationMs,
			costUsd,
		})
		deterministic = applyRunLimits({
			deterministic,
			actionOutput,
			durationMs,
			costUsd,
			request: input.request,
		})
	} catch (error) {
		durationMs = input.request.limits.maxEpisodeMs
		costUsd = input.request.limits.maxCostUsd
		deterministic = {
			...deterministic,
			success: false,
			quality: 0,
			taskSuccess: 0,
			reliability: 0,
			interventions: deterministic.interventions + 1,
			failureModes: ['timeout_or_cost_overrun', 'partial_completion'],
			details: {
				error: error instanceof Error ? error.message : String(error),
			},
		}
	}

	const llmScore =
		input.task.llmRubric && input.request.enableLLMJudge
			? await input.llmJudge.evaluate({
					rubric: input.task.llmRubric,
					prompt: fixture.observation.prompt,
					response: actionOutput.output,
					expectedFacts: fixture.expectedFacts,
				})
			: null

	const metrics = aggregateEpisodeScore(deterministic, durationMs, costUsd, llmScore?.score)
	const success = deterministic.success && metrics.reliability >= 0.8

	const summary = {
		taskId: input.task.id,
		episode: input.episode,
		success,
		metrics,
		failureModes: deterministic.failureModes,
		durationMs,
		costUsd,
	}
	await input.adapter.endEpisode(summary)

	trace.push({
		timestamp: nowIso(),
		kind: 'action',
		payload: {
			output: actionOutput.output,
			toolCalls: actionOutput.toolCalls,
			metadata: actionOutput.metadata,
		},
	})
	trace.push({
		timestamp: nowIso(),
		kind: 'grade',
		payload: {
			deterministic,
			llmJudge: llmScore,
			metrics,
		},
	})

	await input.runtime.teardownEpisode(input.task, fixture)

	return {
		taskId: input.task.id,
		episode: input.episode,
		seed: input.episodeSeed,
		success,
		metrics,
		failureModes: deterministic.failureModes,
		trace,
		deterministic,
		rawAction: actionOutput,
		fixture,
	}
}

const resolveTask = (
	taskId: string,
	overrides?: Record<string, TaskEnvironment>,
): TaskEnvironment => {
	if (overrides?.[taskId]) {
		return overrides[taskId]
	}
	return getTaskEnvironment(taskId)
}

const parallelEpisodes = async (input: {
	task: TaskEnvironment
	request: RunRequest
	runId: string
	runLabel: string
	runtime: DockerEnvironmentRuntime
	customAdapterModule?: string
	llmJudge: LLMJudge
}): Promise<EpisodeResult[]> => {
	const episodeNumbers = Array.from({ length: input.request.episodes }, (_, index) => index + 1)
	const queue = [...episodeNumbers]
	const workerCount = Math.max(1, input.request.parallelism)
	const workers = Array.from({ length: workerCount }, () => [] as EpisodeResult[])
	const adapters = await Promise.all(
		Array.from({ length: workerCount }, () =>
			createAdapter(input.request.agentConfig, input.customAdapterModule),
		),
	)

	await Promise.all(
		adapters.map(async (adapter, workerIndex) => {
			for (;;) {
				const episode = queue.shift()
				if (!episode) {
					break
				}
				const episodeSeed =
					input.request.seed + hashString(`${input.task.id}:${input.request.runLabel}`) + episode
				const result = await runEpisode({
					runId: input.runId,
					runLabel: input.runLabel,
					task: input.task,
					episode,
					episodeSeed,
					adapter,
					runtime: input.runtime,
					request: input.request,
					llmJudge: input.llmJudge,
				})
				workers[workerIndex].push(result)
			}
		}),
	)

	await Promise.all(adapters.map((adapter) => adapter.shutdown()))
	return workers.flat().sort((a, b) => a.episode - b.episode)
}

export interface ExecuteRunOptions {
	baseRunsDir?: string
	customTasks?: Record<string, TaskEnvironment>
	customAdapterModule?: string
	judgeConfig?: {
		endpoint?: string
		model?: string
		apiKeyEnvVar?: string
	}
}

export const executeRun = async (
	request: RunRequest,
	options: ExecuteRunOptions = {},
): Promise<RunWithArtifacts> => {
	const runId = makeRunId('run')
	const startedAt = nowIso()
	const runtime = new DockerEnvironmentRuntime(request.runtime)
	await runtime.bootstrap()
	const llmJudge = new LLMJudge({
		enabled: request.enableLLMJudge,
		...options.judgeConfig,
	})

	const allEpisodes: EpisodeResult[] = []
	for (const taskId of request.taskIds) {
		const task = resolveTask(taskId, options.customTasks)
		await runtime.reset(task)
		const episodes = await parallelEpisodes({
			task,
			request,
			runId,
			runLabel: request.runLabel,
			runtime,
			customAdapterModule: options.customAdapterModule,
			llmJudge,
		})
		allEpisodes.push(...episodes)
	}

	const endedAt = nowIso()
	const summary = buildRunSummary({
		runId,
		label: request.runLabel,
		startedAt,
		endedAt,
		episodes: allEpisodes,
		agent: request.agentConfig,
		limits: request.limits,
	})

	const artifacts = await prepareArtifacts(runId, options.baseRunsDir)
	await writeRunArtifacts(artifacts, summary, allEpisodes)
	return {
		summary,
		episodes: allEpisodes,
		artifacts,
	}
}

export const defaultMockAgentConfig = (): AdapterConfig => ({
	id: 'mock',
	name: 'Mock Agent',
	metadata: {
		qualityBias: 0.76,
		hallucinationRate: 0.04,
	},
})
