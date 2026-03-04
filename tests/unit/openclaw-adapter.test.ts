import { describe, expect, test } from 'bun:test'
import type { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { OpenClawAdapter } from '../../src/core/adapters/openclawAdapter'
import type { EnvObservation, EpisodeContext } from '../../src/core/types'

interface SpawnCall {
	command: string
	args: string[]
}

interface FakeChild extends EventEmitter {
	stdout: PassThrough
	stderr: PassThrough
	stdin: PassThrough
	kill: (signal?: NodeJS.Signals | number) => boolean
}

const observation: EnvObservation = {
	prompt: 'Plan a safe migration',
	context: {
		system: 'payments',
		stage: 'staging',
	},
	constraints: ['No downtime', 'Rollback plan required'],
}

const observationWithSeeds: EnvObservation = {
	...observation,
	seedMessages: [
		'My preferred timezone is PST. Please remember that.',
		'Actually I changed teams yesterday.',
	],
}

const episodeContext = (episode: number): EpisodeContext => ({
	runId: 'run-42',
	runLabel: 'adapter-test',
	taskId: 'memory-pref-1d',
	episode,
	episodeSeed: 7,
	startedAt: '2026-02-27T00:00:00.000Z',
	limits: {
		maxEpisodeMs: 120_000,
		maxCostUsd: 2,
		maxToolCalls: 10,
	},
})

const createFakeChild = (): FakeChild => {
	const child = new EventEmitter() as FakeChild
	child.stdout = new PassThrough()
	child.stderr = new PassThrough()
	child.stdin = new PassThrough()
	child.kill = () => true
	return child
}

const createSpawnStub = (handler: (child: FakeChild, call: SpawnCall) => void) => {
	const calls: SpawnCall[] = []
	const spawnStub = ((command: string, args?: readonly string[]) => {
		const call: SpawnCall = {
			command,
			args: [...(args ?? [])],
		}
		calls.push(call)
		const child = createFakeChild()
		handler(child, call)
		return child as unknown as ReturnType<typeof spawn>
	}) as typeof spawn

	return {
		calls,
		spawnStub,
	}
}

const argValue = (args: string[], flag: string): string | undefined => {
	const index = args.indexOf(flag)
	if (index < 0) {
		return undefined
	}
	return args[index + 1]
}

describe('OpenClawAdapter', () => {
	test('builds openclaw command with config flags and parses JSON response', async () => {
		const { calls, spawnStub } = createSpawnStub((child) => {
			queueMicrotask(() => {
				child.stdout.write(
					JSON.stringify({
						output: 'Use rolling deployment with canary checks.',
						usage: {
							input_tokens: 120,
							output_tokens: 80,
							total_tokens: 200,
							cost_usd: 0.0042,
						},
					}),
				)
				child.emit('close', 0)
			})
		})
		const adapter = new OpenClawAdapter('openclaw', spawnStub)
		await adapter.init({
			id: 'openclaw',
			timeoutMs: 65_000,
			metadata: {
				agentId: 'ops-agent',
				sessionId: 'bench',
				thinking: 'high',
			},
		})
		await adapter.startEpisode(episodeContext(2))

		const action = await adapter.act(observation)
		const call = calls[0]
		expect(call?.command).toBe('openclaw')
		expect(call?.args[0]).toBe('agent')
		expect(call?.args).toContain('--json')
		expect(argValue(call?.args ?? [], '--timeout')).toBe('65')
		expect(argValue(call?.args ?? [], '--agent')).toBe('ops-agent')
		expect(argValue(call?.args ?? [], '--thinking')).toBe('high')
		expect(argValue(call?.args ?? [], '--session-id')).toBe('bench-run-42-ep-2')
		expect(argValue(call?.args ?? [], '--message')).toContain('Task:\nPlan a safe migration')
		expect(argValue(call?.args ?? [], '--message')).toContain('"system": "payments"')
		expect(argValue(call?.args ?? [], '--message')).toContain('1. No downtime')
		expect(action.output).toBe('Use rolling deployment with canary checks.')
		expect(action.metadata).toMatchObject({
			provider: 'openclaw',
			agentId: 'ops-agent',
			sessionId: 'bench-run-42-ep-2',
			estimatedCostUsd: 0.0042,
			usage: {
				input_tokens: 120,
				output_tokens: 80,
				total_tokens: 200,
			},
		})
	})

	test('generates fresh session IDs per episode', async () => {
		const { calls, spawnStub } = createSpawnStub((child) => {
			queueMicrotask(() => {
				child.stdout.write(JSON.stringify({ output: 'ok' }))
				child.emit('close', 0)
			})
		})
		const adapter = new OpenClawAdapter('openclaw', spawnStub)
		await adapter.init({ id: 'openclaw' })

		await adapter.startEpisode(episodeContext(1))
		await adapter.act(observation)
		await adapter.startEpisode(episodeContext(2))
		await adapter.act(observation)

		const firstSessionId = argValue(calls[0]?.args ?? [], '--session-id')
		const secondSessionId = argValue(calls[1]?.args ?? [], '--session-id')
		expect(firstSessionId).toBe('run-42-ep-1')
		expect(secondSessionId).toBe('run-42-ep-2')
		expect(firstSessionId).not.toBe(secondSessionId)
	})

	test('sends seed messages before main prompt in the same session', async () => {
		const { calls, spawnStub } = createSpawnStub((child, call) => {
			const message = argValue(call.args, '--message') ?? ''
			queueMicrotask(() => {
				if (message.includes('Task:\nPlan a safe migration')) {
					child.stdout.write(JSON.stringify({ output: 'Use a canary rollout.' }))
				} else {
					child.stdout.write(JSON.stringify({ status: 'seeded' }))
				}
				child.emit('close', 0)
			})
		})
		const adapter = new OpenClawAdapter('openclaw', spawnStub)
		await adapter.init({ id: 'openclaw' })
		await adapter.startEpisode(episodeContext(1))

		const action = await adapter.act(observationWithSeeds)

		expect(calls).toHaveLength(3)
		expect(argValue(calls[0]?.args ?? [], '--message')).toBe(
			'My preferred timezone is PST. Please remember that.',
		)
		expect(argValue(calls[1]?.args ?? [], '--message')).toBe('Actually I changed teams yesterday.')
		expect(argValue(calls[2]?.args ?? [], '--message')).toContain('Task:\nPlan a safe migration')

		const sessionIds = calls.map((call) => argValue(call.args, '--session-id'))
		expect(new Set(sessionIds).size).toBe(1)
		expect(sessionIds[0]).toBe('run-42-ep-1')
		expect(action.output).toBe('Use a canary rollout.')
		expect(action.metadata).toMatchObject({
			sessionId: 'run-42-ep-1',
			seedMessagesSent: 2,
		})
	})

	test('surfaces command failures', async () => {
		const { spawnStub } = createSpawnStub((child) => {
			queueMicrotask(() => {
				child.stderr.write('gateway unavailable')
				child.emit('close', 1)
			})
		})
		const adapter = new OpenClawAdapter('openclaw', spawnStub)
		await adapter.init({ id: 'openclaw' })
		await adapter.startEpisode(episodeContext(1))

		await expect(adapter.act(observation)).rejects.toThrow(
			'adapter openclaw command failed (1): gateway unavailable',
		)
	})
})
