import path from 'node:path'
import { parseAdapterConfig } from '../core/adapters'
import { defaultMockAgentConfig } from '../core/runtime/orchestrator'
import type { AdapterConfig, RunLimits, RunRequest, RuntimeOptions } from '../core/types'

export interface CommonRunCliOptions {
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

export const resolveAgentConfig = async (options: CommonRunCliOptions): Promise<AdapterConfig> => {
	if (options.agent) {
		const filePath = path.resolve(process.cwd(), options.agent)
		return parseAdapterConfig(filePath)
	}
	if (options.adapter) {
		return {
			...defaultMockAgentConfig(),
			id: options.adapter,
		}
	}
	return defaultMockAgentConfig()
}

export const parseRuntimeOptions = (options: CommonRunCliOptions): RuntimeOptions => {
	return {
		parallelism: Math.max(1, options.parallel ?? 1),
		useDocker: options.docker ?? true,
		highIsolation: options.highIsolation ?? false,
		maxEpisodeMs: options.maxEpisodeMs ?? 120_000,
	}
}

export const parseRunLimits = (options: CommonRunCliOptions): RunLimits => {
	return {
		maxEpisodeMs: options.maxEpisodeMs ?? 120_000,
		maxCostUsd: options.maxCostUsd ?? 2,
		maxToolCalls: options.maxToolCalls ?? 30,
	}
}

export const createRunRequest = async (input: {
	taskIds: string[]
	options: CommonRunCliOptions
	runLabel: string
}): Promise<RunRequest> => {
	const agentConfig = await resolveAgentConfig(input.options)
	return {
		runLabel: input.options.runLabel ?? input.runLabel,
		taskIds: input.taskIds,
		episodes: Math.max(1, input.options.episodes ?? 20),
		seed: input.options.seed ?? 42,
		parallelism: Math.max(1, input.options.parallel ?? 1),
		agentConfig,
		runtime: parseRuntimeOptions(input.options),
		limits: parseRunLimits(input.options),
		enableLLMJudge: input.options.enableLlmJudge ?? false,
	}
}

export const parseTaskListArg = (taskArg?: string): string[] => {
	if (!taskArg || taskArg.trim() === '') {
		throw new Error('task ID required')
	}
	return taskArg
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean)
}
