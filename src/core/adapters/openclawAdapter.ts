import { spawn } from 'node:child_process'
import type {
	AdapterConfig,
	AgentAction,
	AgentAdapter,
	EnvObservation,
	EpisodeContext,
	EpisodeSummary,
} from '../types'

interface JsonRecord {
	[key: string]: unknown
}

interface UsageDetails {
	inputTokens?: number
	outputTokens?: number
	totalTokens?: number
	costUsd?: number
}

const asRecord = (value: unknown): JsonRecord | null => {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return value as JsonRecord
	}
	return null
}

const toFiniteNumber = (value: unknown): number | undefined => {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value
	}
	if (typeof value === 'string' && value.trim().length > 0) {
		const parsed = Number(value)
		if (Number.isFinite(parsed)) {
			return parsed
		}
	}
	return undefined
}

const sanitizeSessionPart = (value: string): string => {
	const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-')
	const trimmed = normalized.replace(/^-+|-+$/g, '')
	return trimmed.length > 0 ? trimmed : 'session'
}

const metadataString = (
	metadata: Record<string, unknown> | undefined,
	key: string,
): string | undefined => {
	const value = metadata?.[key]
	if (typeof value === 'string') {
		const trimmed = value.trim()
		return trimmed.length > 0 ? trimmed : undefined
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value)
	}
	return undefined
}

const formatConstraints = (constraints: string[]): string => {
	if (constraints.length === 0) {
		return '- none'
	}
	return constraints.map((constraint, index) => `${index + 1}. ${constraint}`).join('\n')
}

const buildPrompt = (input: EnvObservation): string => {
	return [
		`Task:\n${input.prompt}`,
		`Context (JSON):\n${JSON.stringify(input.context, null, 2)}`,
		`Constraints:\n${formatConstraints(input.constraints)}`,
	].join('\n\n')
}

const parseJsonFromStdout = (stdout: string): unknown => {
	const trimmed = stdout.trim()
	if (trimmed.length === 0) {
		throw new Error('openclaw returned empty stdout')
	}

	const candidates: string[] = [trimmed]
	const firstObject = trimmed.indexOf('{')
	const firstArray = trimmed.indexOf('[')
	const starts = [firstObject, firstArray].filter((index) => index >= 0)
	if (starts.length > 0) {
		const start = Math.min(...starts)
		const lastObject = trimmed.lastIndexOf('}')
		const lastArray = trimmed.lastIndexOf(']')
		const end = Math.max(lastObject, lastArray)
		if (end > start) {
			candidates.push(trimmed.slice(start, end + 1))
		}
	}

	for (const candidate of candidates) {
		try {
			return JSON.parse(candidate)
		} catch {}
	}

	throw new Error('openclaw returned invalid JSON output')
}

const extractTextChunks = (value: unknown, depth = 0): string[] => {
	if (depth > 5 || value === null || value === undefined) {
		return []
	}

	if (typeof value === 'string') {
		const trimmed = value.trim()
		return trimmed.length > 0 ? [trimmed] : []
	}

	if (Array.isArray(value)) {
		const chunks = value.flatMap((entry) => {
			const entryRecord = asRecord(entry)
			if (
				entryRecord?.type === 'text' &&
				typeof entryRecord.text === 'string' &&
				entryRecord.text.trim().length > 0
			) {
				return [entryRecord.text.trim()]
			}
			return extractTextChunks(entry, depth + 1)
		})
		return chunks.filter((chunk) => chunk.length > 0)
	}

	const record = asRecord(value)
	if (!record) {
		return []
	}

	const directKeys = [
		'output',
		'reply',
		'response_text',
		'responseText',
		'assistant',
		'assistant_response',
		'answer',
		'text',
	]
	for (const key of directKeys) {
		if (!(key in record)) {
			continue
		}
		const chunks = extractTextChunks(record[key], depth + 1)
		if (chunks.length > 0) {
			return chunks
		}
	}

	if (Array.isArray(record.choices)) {
		for (const choice of record.choices) {
			const choiceRecord = asRecord(choice)
			if (!choiceRecord) {
				continue
			}
			const chunks = extractTextChunks(
				choiceRecord.message ?? choiceRecord.delta ?? choiceRecord.content ?? choiceRecord,
				depth + 1,
			)
			if (chunks.length > 0) {
				return chunks
			}
		}
	}

	for (const key of ['response', 'message', 'content', 'result', 'data', 'payloads']) {
		if (!(key in record)) {
			continue
		}
		const chunks = extractTextChunks(record[key], depth + 1)
		if (chunks.length > 0) {
			return chunks
		}
	}

	return []
}

const extractReplyText = (payload: unknown): string | null => {
	const chunks = extractTextChunks(payload)
	const text = chunks.join('\n').trim()
	return text.length > 0 ? text : null
}

const collectUsageCandidates = (value: unknown, depth = 0): JsonRecord[] => {
	if (depth > 3 || value === null || value === undefined) {
		return []
	}
	if (Array.isArray(value)) {
		return value.flatMap((entry) => collectUsageCandidates(entry, depth + 1))
	}
	const record = asRecord(value)
	if (!record) {
		return []
	}

	const candidates = [record]
	for (const [key, nested] of Object.entries(record)) {
		if (!/(usage|token|cost|metric|billing|result|response|data)/i.test(key)) {
			continue
		}
		candidates.push(...collectUsageCandidates(nested, depth + 1))
	}
	return candidates
}

const pickNumericKey = (records: JsonRecord[], keys: string[]): number | undefined => {
	for (const record of records) {
		for (const key of keys) {
			const value = toFiniteNumber(record[key])
			if (value !== undefined) {
				return value
			}
		}
	}
	return undefined
}

const extractUsageDetails = (payload: unknown): UsageDetails => {
	const candidates = collectUsageCandidates(payload)
	const inputTokens = pickNumericKey(candidates, ['input_tokens', 'prompt_tokens', 'inputTokens'])
	const outputTokens = pickNumericKey(candidates, [
		'output_tokens',
		'completion_tokens',
		'outputTokens',
	])
	const reportedTotal = pickNumericKey(candidates, ['total_tokens', 'totalTokens'])
	const totalTokens =
		reportedTotal ??
		(typeof inputTokens === 'number' && typeof outputTokens === 'number'
			? inputTokens + outputTokens
			: undefined)
	const costUsd = pickNumericKey(candidates, [
		'cost_usd',
		'estimated_cost_usd',
		'costUsd',
		'estimatedCostUsd',
	])

	return {
		inputTokens,
		outputTokens,
		totalTokens,
		costUsd,
	}
}

const toTimeoutSeconds = (timeoutMs: number): number => {
	return Math.max(1, Math.ceil(timeoutMs / 1000))
}

export class OpenClawAdapter implements AgentAdapter {
	readonly id: string
	private command = 'openclaw'
	private timeoutMs = 60_000
	private agentId?: string
	private sessionPrefix?: string
	private activeSessionId?: string
	private thinking?: string
	private spawnProcess: typeof spawn

	constructor(id = 'openclaw', spawnProcess: typeof spawn = spawn) {
		this.id = id
		this.spawnProcess = spawnProcess
	}

	async init(config: AdapterConfig): Promise<void> {
		this.command = config.command ?? this.command
		this.timeoutMs = config.timeoutMs ?? this.timeoutMs
		this.agentId = metadataString(config.metadata, 'agentId')
		this.sessionPrefix = metadataString(config.metadata, 'sessionId')
		this.thinking = metadataString(config.metadata, 'thinking')
		this.activeSessionId = this.sessionPrefix ? sanitizeSessionPart(this.sessionPrefix) : undefined
	}

	async startEpisode(ctx: EpisodeContext): Promise<void> {
		const parts = [
			this.sessionPrefix ? sanitizeSessionPart(this.sessionPrefix) : '',
			sanitizeSessionPart(ctx.runId),
			`ep-${ctx.episode}`,
		].filter((part) => part.length > 0)
		this.activeSessionId = parts.join('-')
	}

	private buildArgs(message: string, sessionId: string | undefined): string[] {
		const timeoutSeconds = toTimeoutSeconds(this.timeoutMs)
		const args = ['agent', '--message', message, '--json', '--timeout', String(timeoutSeconds)]
		if (this.agentId) {
			args.push('--agent', this.agentId)
		}
		if (sessionId) {
			args.push('--session-id', sessionId)
		}
		if (this.thinking) {
			args.push('--thinking', this.thinking)
		}
		return args
	}

	private runMessage(input: {
		message: string
		sessionId: string | undefined
		allowEmptyOutput?: boolean
	}): Promise<{ output: string | null; usage: UsageDetails }> {
		const args = this.buildArgs(input.message, input.sessionId)
		return new Promise<{ output: string | null; usage: UsageDetails }>((resolve, reject) => {
			const child = this.spawnProcess(this.command, args, {
				env: process.env,
				stdio: ['pipe', 'pipe', 'pipe'],
			})
			let stdout = ''
			let stderr = ''
			let settled = false

			const settle = (callback: () => void): void => {
				if (settled) {
					return
				}
				settled = true
				clearTimeout(timer)
				callback()
			}

			const timer = setTimeout(() => {
				child.kill('SIGKILL')
				settle(() => {
					reject(new Error(`adapter ${this.id} timed out after ${this.timeoutMs}ms`))
				})
			}, this.timeoutMs + 1_000)

			child.stdout?.on('data', (chunk) => {
				stdout += chunk.toString('utf-8')
			})

			child.stderr?.on('data', (chunk) => {
				stderr += chunk.toString('utf-8')
			})

			child.on('error', (error) => {
				settle(() => reject(error))
			})

			child.on('close', (code) => {
				settle(() => {
					if (code !== 0) {
						const details = stderr.trim() || stdout.trim()
						reject(new Error(`adapter ${this.id} command failed (${code}): ${details}`))
						return
					}

					let payload: unknown
					try {
						payload = parseJsonFromStdout(stdout)
					} catch (error) {
						reject(error)
						return
					}

					const output = extractReplyText(payload)
					if (!input.allowEmptyOutput && !output) {
						reject(new Error(`adapter ${this.id} returned empty output text`))
						return
					}

					resolve({ output, usage: extractUsageDetails(payload) })
				})
			})

			child.stdin?.end()
		})
	}

	async act(input: EnvObservation): Promise<AgentAction> {
		const started = Date.now()
		const sessionId = this.activeSessionId
		const seedMessages = input.seedMessages?.filter((message) => message.trim().length > 0) ?? []
		for (const seedMessage of seedMessages) {
			await this.runMessage({
				message: seedMessage,
				sessionId,
				allowEmptyOutput: true,
			})
		}

		const mainReply = await this.runMessage({
			message: buildPrompt(input),
			sessionId,
		})

		if (!mainReply.output) {
			throw new Error(`adapter ${this.id} returned empty output text`)
		}

		return {
			output: mainReply.output,
			metadata: {
				provider: 'openclaw',
				command: this.command,
				agentId: this.agentId,
				sessionId,
				thinking: this.thinking,
				seedMessagesSent: seedMessages.length,
				durationMs: Date.now() - started,
				estimatedCostUsd: mainReply.usage.costUsd,
				usage: {
					input_tokens: mainReply.usage.inputTokens,
					output_tokens: mainReply.usage.outputTokens,
					total_tokens: mainReply.usage.totalTokens,
				},
			},
		}
	}

	async endEpisode(_summary: EpisodeSummary): Promise<void> {}

	async shutdown(): Promise<void> {
		this.activeSessionId = undefined
	}
}
