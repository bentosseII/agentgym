import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { executeRun } from '../../src/core/runtime'

const tempDirs: string[] = []

afterEach(async () => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop()
		if (dir) {
			await rm(dir, { recursive: true, force: true })
		}
	}
})

const baseRequest = () => ({
	runLabel: 'limit-test',
	taskIds: ['memory-pref-1d'],
	episodes: 1,
	seed: 123,
	parallelism: 1,
	agentConfig: {
		id: 'mock',
		metadata: {
			qualityBias: 1,
			hallucinationRate: 0,
		},
	},
	runtime: {
		parallelism: 1,
		useDocker: false,
		highIsolation: false,
		maxEpisodeMs: 120_000,
	},
	limits: {
		maxEpisodeMs: 120_000,
		maxCostUsd: 2,
		maxToolCalls: 10,
	},
	enableLLMJudge: false,
})

const withTempRuns = async () => {
	const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'agentgym-limits-'))
	tempDirs.push(tempRoot)
	return tempRoot
}

describe('run limits', () => {
	test('marks episode failed when cost exceeds limit', async () => {
		const tempRoot = await withTempRuns()
		const result = await executeRun(
			{
				...baseRequest(),
				limits: {
					...baseRequest().limits,
					maxCostUsd: 0.000001,
				},
			},
			{ baseRunsDir: tempRoot },
		)
		const episode = result.episodes[0]
		expect(episode?.success).toBe(false)
		expect(episode?.failureModes).toContain('timeout_or_cost_overrun')
	})

	test('marks episode failed when tool calls exceed limit', async () => {
		const tempRoot = await withTempRuns()
		const customAdapterPath = path.resolve(process.cwd(), 'tests/fixtures/custom-limit-adapter.ts')
		const result = await executeRun(
			{
				...baseRequest(),
				agentConfig: {
					id: 'custom-limit',
					metadata: {
						toolCalls: 5,
					},
				},
				limits: {
					...baseRequest().limits,
					maxToolCalls: 1,
				},
			},
			{
				baseRunsDir: tempRoot,
				customAdapterModule: customAdapterPath,
			},
		)
		const episode = result.episodes[0]
		expect(episode?.success).toBe(false)
		expect(episode?.failureModes).toContain('tool_misuse')
	})

	test('enforces hard maxEpisodeMs timeout', async () => {
		const tempRoot = await withTempRuns()
		const customAdapterPath = path.resolve(process.cwd(), 'tests/fixtures/custom-limit-adapter.ts')
		const result = await executeRun(
			{
				...baseRequest(),
				agentConfig: {
					id: 'custom-limit',
					metadata: {
						sleepMs: 40,
					},
				},
				limits: {
					...baseRequest().limits,
					maxEpisodeMs: 10,
				},
			},
			{
				baseRunsDir: tempRoot,
				customAdapterModule: customAdapterPath,
			},
		)
		const episode = result.episodes[0]
		expect(episode?.success).toBe(false)
		expect(episode?.failureModes).toContain('timeout_or_cost_overrun')
	})
})
