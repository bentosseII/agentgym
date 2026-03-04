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

describe('executeRun', () => {
	test('runs episodes and writes artifacts', async () => {
		const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'agentgym-test-'))
		tempDirs.push(tempRoot)
		const result = await executeRun(
			{
				runLabel: 'unit-run',
				taskIds: ['memory-pref-1d'],
				episodes: 3,
				seed: 111,
				parallelism: 2,
				agentConfig: {
					id: 'mock',
					metadata: {
						qualityBias: 0.9,
						hallucinationRate: 0,
					},
				},
				runtime: {
					parallelism: 2,
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
			},
			{ baseRunsDir: tempRoot },
		)
		expect(result.summary.episodeCount).toBe(3)
		expect(result.summary.tasks[0]?.taskId).toBe('memory-pref-1d')
		expect(result.summary.overall.qualityMean).toBeGreaterThan(4)
	})
})
