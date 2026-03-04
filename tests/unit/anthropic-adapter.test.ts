import { afterEach, describe, expect, test } from 'bun:test'
import { AnthropicAdapter } from '../../src/core/adapters/anthropicAdapter'
import type { EnvObservation, EpisodeContext } from '../../src/core/types'

const observation: EnvObservation = {
	prompt: 'Summarize incident response status',
	context: {
		incidentId: 'INC-100',
		severity: 'high',
	},
	constraints: ['Use concise bullet points', 'Do not invent timeline events'],
}

const observationWithSeeds: EnvObservation = {
	...observation,
	seedMessages: [
		'Remember this preference: timezone is PST.',
		'Remember too: deploy day is Thursday.',
	],
}

const episodeContext: EpisodeContext = {
	runId: 'run-42',
	runLabel: 'adapter-test',
	taskId: 'memory-pref-1d',
	episode: 1,
	episodeSeed: 7,
	startedAt: '2026-02-27T00:00:00.000Z',
	limits: {
		maxEpisodeMs: 120_000,
		maxCostUsd: 2,
		maxToolCalls: 10,
	},
}

const originalFetch = globalThis.fetch
const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY

afterEach(() => {
	globalThis.fetch = originalFetch
	if (originalAnthropicApiKey === undefined) {
		delete process.env.ANTHROPIC_API_KEY
	} else {
		process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey
	}
})

describe('AnthropicAdapter', () => {
	test('calls Anthropic Messages API and returns usage metadata', async () => {
		process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
		let capturedUrl = ''
		let capturedInit: RequestInit | undefined
		globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
			capturedUrl = String(url)
			capturedInit = init
			return new Response(
				JSON.stringify({
					content: [{ type: 'text', text: 'Incident is contained and monitoring is active.' }],
					usage: {
						input_tokens: 2000,
						output_tokens: 4000,
					},
				}),
				{ status: 200 },
			)
		}) as unknown as typeof fetch

		const adapter = new AnthropicAdapter()
		await adapter.init({
			id: 'anthropic',
			timeoutMs: 20_000,
		})
		await adapter.startEpisode(episodeContext)

		const action = await adapter.act(observation)
		const body = JSON.parse(String(capturedInit?.body))
		const headers = capturedInit?.headers as Record<string, string>
		expect(capturedUrl).toBe('https://api.anthropic.com/v1/messages')
		expect(headers['x-api-key']).toBe('test-anthropic-key')
		expect(body.model).toBe('claude-sonnet-4-20250514')
		expect(body.messages?.[0]?.content).toContain('Task:\nSummarize incident response status')
		expect(body.messages?.[0]?.content).toContain('"incidentId": "INC-100"')
		expect(body.messages?.[0]?.content).toContain('1. Use concise bullet points')
		expect(action.output).toBe('Incident is contained and monitoring is active.')
		expect(action.metadata).toMatchObject({
			provider: 'anthropic',
			model: 'claude-sonnet-4-20250514',
			estimatedCostUsd: 0.066,
			usage: {
				input_tokens: 2000,
				output_tokens: 4000,
				total_tokens: 6000,
			},
		})
	})

	test('throws when ANTHROPIC_API_KEY is missing', async () => {
		delete process.env.ANTHROPIC_API_KEY
		const adapter = new AnthropicAdapter()
		await expect(adapter.init({ id: 'anthropic' })).rejects.toThrow(
			'adapter anthropic missing API key env var ANTHROPIC_API_KEY',
		)
	})

	test('throws on non-200 API response', async () => {
		process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
		globalThis.fetch = (async () => {
			return new Response('bad request', { status: 400 })
		}) as unknown as typeof fetch
		const adapter = new AnthropicAdapter()
		await adapter.init({ id: 'anthropic' })
		await adapter.startEpisode(episodeContext)

		await expect(adapter.act(observation)).rejects.toThrow(
			'adapter anthropic request failed: 400 bad request',
		)
	})

	test('adds seed messages as prior conversation turns', async () => {
		process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
		let capturedInit: RequestInit | undefined
		globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
			capturedInit = init
			return new Response(
				JSON.stringify({
					content: [{ type: 'text', text: 'Seeded response.' }],
					usage: {
						input_tokens: 10,
						output_tokens: 5,
					},
				}),
				{ status: 200 },
			)
		}) as unknown as typeof fetch

		const adapter = new AnthropicAdapter()
		await adapter.init({ id: 'anthropic' })
		await adapter.startEpisode(episodeContext)
		await adapter.act(observationWithSeeds)

		const body = JSON.parse(String(capturedInit?.body))
		expect(body.messages).toHaveLength(3)
		expect(body.messages[0]).toEqual({
			role: 'user',
			content: 'Remember this preference: timezone is PST.',
		})
		expect(body.messages[1]).toEqual({
			role: 'user',
			content: 'Remember too: deploy day is Thursday.',
		})
		expect(body.messages[2].content).toContain('Task:\nSummarize incident response status')
	})
})
