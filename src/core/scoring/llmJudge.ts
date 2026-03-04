import { z } from 'zod'

const judgeOutputSchema = z
	.object({
		score: z.number().min(1).max(10),
		reasoning: z.string().min(1).optional(),
		rationale: z.string().min(1).optional(),
		failure_modes: z.array(z.string().min(1)).optional(),
		failureModes: z.array(z.string().min(1)).optional(),
	})
	.refine((value) => Boolean(value.reasoning ?? value.rationale), {
		message: 'reasoning or rationale is required',
	})

interface AnthropicJudgeContentBlock {
	type?: string
	text?: string
}

interface AnthropicJudgeResponse {
	content?: AnthropicJudgeContentBlock[]
}

export interface LLMJudgeConfig {
	enabled: boolean
	endpoint?: string
	model?: string
	apiKeyEnvVar?: string
	timeoutMs?: number
}

export interface LLMJudgeResult {
	score: number
	reasoning: string
	failureModes: string[]
}

const extractJudgeText = (payload: AnthropicJudgeResponse): string | null => {
	const text = payload.content
		?.filter((entry) => entry.type === 'text' && typeof entry.text === 'string')
		.map((entry) => entry.text?.trim() ?? '')
		.filter(Boolean)
		.join('\n')
	return text && text.length > 0 ? text : null
}

const parseJudgeOutput = (rawText: string): LLMJudgeResult | null => {
	const candidates = [rawText.trim()]
	const firstBrace = rawText.indexOf('{')
	const lastBrace = rawText.lastIndexOf('}')
	if (firstBrace >= 0 && lastBrace > firstBrace) {
		const bracketed = rawText.slice(firstBrace, lastBrace + 1).trim()
		if (bracketed.length > 0) {
			candidates.push(bracketed)
		}
	}

	for (const candidate of candidates) {
		if (candidate.length === 0) {
			continue
		}
		let parsedJson: unknown
		try {
			parsedJson = JSON.parse(candidate)
		} catch {
			continue
		}
		const parsed = judgeOutputSchema.safeParse(parsedJson)
		if (!parsed.success) {
			continue
		}
		return {
			score: parsed.data.score,
			reasoning: parsed.data.reasoning ?? parsed.data.rationale ?? '',
			failureModes: parsed.data.failure_modes ?? parsed.data.failureModes ?? [],
		}
	}

	return null
}

export class LLMJudge {
	private readonly config: LLMJudgeConfig

	constructor(config: LLMJudgeConfig) {
		this.config = config
	}

	private resolveApiKey(): string | null {
		if (this.config.apiKeyEnvVar) {
			return process.env[this.config.apiKeyEnvVar] ?? null
		}
		return process.env.ANTHROPIC_API_KEY ?? process.env.AGENTGYM_JUDGE_API_KEY ?? null
	}

	get enabled(): boolean {
		if (!this.config.enabled) {
			return false
		}
		return Boolean(this.resolveApiKey())
	}

	async evaluate(input: {
		rubric: string
		prompt: string
		response: string
		expectedFacts: string[]
	}): Promise<LLMJudgeResult | null> {
		if (!this.enabled) {
			return null
		}
		const endpoint = this.config.endpoint ?? 'https://api.anthropic.com/v1/messages'
		const model = this.config.model ?? 'claude-sonnet-4-20250514'
		const apiKey = this.resolveApiKey()
		if (!apiKey) {
			return null
		}
		const timeoutMs = this.config.timeoutMs ?? 30_000
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), timeoutMs)

		let response: Response
		try {
			response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
				},
				body: JSON.stringify({
					model,
					temperature: 0,
					max_tokens: 400,
					system:
						'You are a strict evaluator for AgentGym. Return JSON only with keys: score, reasoning, failure_modes.',
					messages: [
						{
							role: 'user',
							content: [
								`Rubric:\n${input.rubric}`,
								`Task prompt:\n${input.prompt}`,
								`Expected facts:\n${
									input.expectedFacts.length > 0
										? input.expectedFacts.map((fact, index) => `${index + 1}. ${fact}`).join('\n')
										: '- none provided'
								}`,
								`Agent response:\n${input.response}`,
								'Score from 1 to 10. Output strict JSON only.',
							].join('\n\n'),
						},
					],
				}),
				signal: controller.signal,
			})
		} catch {
			return null
		} finally {
			clearTimeout(timer)
		}

		if (!response.ok) {
			return null
		}

		const payload = (await response.json()) as AnthropicJudgeResponse
		const outputText = extractJudgeText(payload)

		if (!outputText) {
			return null
		}

		return parseJudgeOutput(outputText)
	}
}
