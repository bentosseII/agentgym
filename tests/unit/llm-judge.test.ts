import { afterEach, describe, expect, test } from 'bun:test'
import { LLMJudge } from '../../src/core/scoring/llmJudge'

const originalFetch = globalThis.fetch
const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY
const originalJudgeApiKey = process.env.AGENTGYM_JUDGE_API_KEY

afterEach(() => {
	globalThis.fetch = originalFetch
	if (originalAnthropicApiKey === undefined) {
		delete process.env.ANTHROPIC_API_KEY
	} else {
		process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey
	}
	if (originalJudgeApiKey === undefined) {
		delete process.env.AGENTGYM_JUDGE_API_KEY
	} else {
		process.env.AGENTGYM_JUDGE_API_KEY = originalJudgeApiKey
	}
})

describe('LLMJudge', () => {
	test('evaluates rubric with Anthropic and parses JSON score', async () => {
		process.env.ANTHROPIC_API_KEY = 'judge-key'
		let capturedBody: unknown = null
		globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
			capturedBody = JSON.parse(String(init?.body))
			return new Response(
				JSON.stringify({
					content: [
						{
							type: 'text',
							text: 'Result:\n{"score":8,"reasoning":"Grounded and complete","failure_modes":["none"]}',
						},
					],
				}),
				{ status: 200 },
			)
		}) as unknown as typeof fetch
		const judge = new LLMJudge({ enabled: true })

		const result = await judge.evaluate({
			rubric: 'Reward factual accuracy and complete recall.',
			prompt: 'What changed in the incident timeline?',
			response: 'The timeline includes containment and root-cause analysis updates.',
			expectedFacts: ['containment completed', 'root-cause analysis started'],
		})

		expect(capturedBody).not.toBeNull()
		if (!capturedBody) {
			throw new Error('expected request body to be captured')
		}
		const body = capturedBody as {
			model?: string
			messages?: Array<{ content?: string }>
		}
		expect(body.model).toBe('claude-sonnet-4-20250514')
		const messages = body.messages
		expect(messages?.[0]?.content).toContain('Expected facts:\n1. containment completed')
		expect(result).toEqual({
			score: 8,
			reasoning: 'Grounded and complete',
			failureModes: ['none'],
		})
	})

	test('returns null when API key is not available', async () => {
		delete process.env.ANTHROPIC_API_KEY
		delete process.env.AGENTGYM_JUDGE_API_KEY
		const judge = new LLMJudge({ enabled: true })
		expect(judge.enabled).toBe(false)

		const result = await judge.evaluate({
			rubric: 'Score quality.',
			prompt: 'Prompt',
			response: 'Response',
			expectedFacts: [],
		})

		expect(result).toBeNull()
	})

	test('returns null when judge output is not parseable JSON', async () => {
		process.env.ANTHROPIC_API_KEY = 'judge-key'
		globalThis.fetch = (async () => {
			return new Response(
				JSON.stringify({
					content: [{ type: 'text', text: 'score: eight out of ten' }],
				}),
				{ status: 200 },
			)
		}) as unknown as typeof fetch
		const judge = new LLMJudge({ enabled: true })

		const result = await judge.evaluate({
			rubric: 'Score quality.',
			prompt: 'Prompt',
			response: 'Response',
			expectedFacts: ['fact'],
		})

		expect(result).toBeNull()
	})
})
