import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
	EnvironmentFixture,
	EnvironmentRuntime,
	RuntimeCaps,
	RuntimeOptions,
	TaskEnvironment,
} from '../types'

const execFileAsync = promisify(execFile)

const hasDocker = async (): Promise<boolean> => {
	try {
		await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}'])
		return true
	} catch {
		return false
	}
}

export class DockerEnvironmentRuntime implements EnvironmentRuntime {
	readonly caps: RuntimeCaps
	private readonly options: RuntimeOptions
	private dockerReady = false

	constructor(options: RuntimeOptions) {
		this.options = options
		this.caps = {
			docker: options.useDocker,
			highIsolation: options.highIsolation,
			deterministicClock: true,
		}
	}

	async bootstrap(): Promise<void> {
		this.dockerReady = this.options.useDocker ? await hasDocker() : false
	}

	private async runDockerIsolationProbe(
		task: TaskEnvironment,
		fixture: EnvironmentFixture,
	): Promise<void> {
		if (!this.dockerReady) {
			return
		}
		const tag = `task=${task.id};seed=${fixture.seed};episode=${fixture.id}`
		await execFileAsync('docker', [
			'run',
			'--rm',
			'--network',
			'none',
			'--cpus',
			'0.5',
			'--memory',
			'128m',
			'alpine:3.20',
			'sh',
			'-lc',
			`echo "agentgym-isolated ${tag}" >/dev/null`,
		])
	}

	async setupEpisode(task: TaskEnvironment, fixture: EnvironmentFixture): Promise<void> {
		await this.runDockerIsolationProbe(task, fixture)
	}

	async teardownEpisode(_task: TaskEnvironment, _fixture: EnvironmentFixture): Promise<void> {}

	async reset(task: TaskEnvironment): Promise<void> {
		if (!this.dockerReady) {
			return
		}
		if (task.reset.mode === 'git_reset' && task.reset.target) {
			await execFileAsync('docker', [
				'run',
				'--rm',
				'-v',
				`${task.reset.target}:/workspace`,
				'alpine:3.20',
				'sh',
				'-lc',
				'cd /workspace && git reset --hard >/dev/null 2>&1 || true',
			])
		}
	}

	get dockerAvailable(): boolean {
		return this.dockerReady
	}
}
