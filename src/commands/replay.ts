import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Command } from 'commander'
import { fileExists, logInfo } from '../core'

interface ReplayOptions {
	episode?: number
	task?: string
	runsDir?: string
}

const findTraceFile = async (
	episodesDir: string,
	episode: number,
	task?: string,
): Promise<string> => {
	const episodeSuffix = `ep${String(episode).padStart(3, '0')}.trace.jsonl`
	const files = await readdir(episodesDir)
	const candidates = files.filter((file) => {
		if (!file.endsWith(episodeSuffix)) {
			return false
		}
		return task ? file.startsWith(`${task}-`) : true
	})
	if (candidates.length === 0) {
		throw new Error(`trace not found for episode ${episode}${task ? ` task ${task}` : ''}`)
	}
	return path.join(episodesDir, candidates[0])
}

export const registerReplayCommand = (program: Command): void => {
	program
		.command('replay')
		.description('Replay a stored episode trace')
		.argument('<run-id>', 'Run ID')
		.requiredOption('--episode <n>', 'Episode number', (value) => Number(value))
		.option('--task <task-id>', 'Task ID filter')
		.option('--runs-dir <path>', 'Runs directory', 'runs')
		.action(async (runId: string, options: ReplayOptions) => {
			const runsDir = path.resolve(process.cwd(), options.runsDir ?? 'runs')
			const episodesDir = path.join(runsDir, runId, 'episodes')
			if (!(await fileExists(episodesDir))) {
				throw new Error(`run not found: ${runId}`)
			}
			const tracePath = await findTraceFile(episodesDir, options.episode ?? 1, options.task)
			const raw = await readFile(tracePath, 'utf-8')
			for (const line of raw.split('\n').filter(Boolean)) {
				const event = JSON.parse(line) as {
					timestamp: string
					kind: string
					payload: Record<string, unknown>
				}
				logInfo(`${event.timestamp} [${event.kind}]`)
				logInfo(JSON.stringify(event.payload, null, 2))
			}
		})
}
