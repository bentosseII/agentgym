import { spawn } from 'node:child_process'
import type {
	AdapterConfig,
	AgentAction,
	AgentAdapter,
	EnvObservation,
	EpisodeContext,
	EpisodeSummary,
} from '../types'

export class ShellAdapter implements AgentAdapter {
	readonly id: string
	private command = ''
	private timeoutMs = 60_000

	constructor(id = 'shell') {
		this.id = id
	}

	async init(config: AdapterConfig): Promise<void> {
		if (!config.command) {
			throw new Error(`adapter ${this.id} requires 'command' in config`)
		}
		this.command = config.command
		this.timeoutMs = config.timeoutMs ?? 60_000
	}

	async startEpisode(_ctx: EpisodeContext): Promise<void> {}

	async act(input: EnvObservation): Promise<AgentAction> {
		const payload = JSON.stringify(input)
		const started = Date.now()
		return new Promise<AgentAction>((resolve, reject) => {
			const child = spawn(this.command, {
				shell: true,
				stdio: ['pipe', 'pipe', 'pipe'],
				env: process.env,
			})
			let stdout = ''
			let stderr = ''

			const timer = setTimeout(() => {
				child.kill('SIGKILL')
				reject(new Error(`adapter command timed out in ${this.timeoutMs}ms`))
			}, this.timeoutMs)

			child.stdout.on('data', (chunk: Buffer) => {
				stdout += chunk.toString('utf-8')
			})

			child.stderr.on('data', (chunk: Buffer) => {
				stderr += chunk.toString('utf-8')
			})

			child.on('error', (error) => {
				clearTimeout(timer)
				reject(error)
			})

			child.on('close', (code) => {
				clearTimeout(timer)
				if (code !== 0) {
					reject(new Error(`adapter command failed (${code}): ${stderr.trim()}`))
					return
				}

				const parsed = stdout.trim()
				resolve({
					output: parsed,
					metadata: {
						durationMs: Date.now() - started,
					},
				})
			})

			child.stdin.write(payload)
			child.stdin.end()
		})
	}

	async endEpisode(_summary: EpisodeSummary): Promise<void> {}

	async shutdown(): Promise<void> {}
}
