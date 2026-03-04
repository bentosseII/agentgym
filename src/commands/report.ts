import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Command } from 'commander'
import {
	type EpisodeResult,
	fileExists,
	logInfo,
	type RunSummary,
	readJson,
	renderHtmlReport,
	renderMarkdownReport,
} from '../core'

interface ReportOptions {
	format?: 'html' | 'json' | 'md'
	runsDir?: string
}

export const registerReportCommand = (program: Command): void => {
	program
		.command('report')
		.description('Render report from run artifacts')
		.argument('<run-id>', 'Run ID')
		.option('--format <format>', 'Output format html|json|md', 'md')
		.option('--runs-dir <path>', 'Runs directory', 'runs')
		.action(async (runId: string, options: ReportOptions) => {
			const runsDir = path.resolve(process.cwd(), options.runsDir ?? 'runs')
			const runDir = path.join(runsDir, runId)
			const resultsPath = path.join(runDir, 'results.json')
			if (!(await fileExists(resultsPath))) {
				throw new Error(`results not found for run ${runId}`)
			}
			const payload = await readJson<{ summary: RunSummary; episodes: EpisodeResult[] }>(
				resultsPath,
			)
			const format = options.format ?? 'md'
			if (format === 'json') {
				logInfo(JSON.stringify(payload.summary, null, 2))
				return
			}
			if (format === 'md') {
				const report = renderMarkdownReport(payload.summary)
				const target = path.join(runDir, 'report.md')
				await writeFile(target, report, 'utf-8')
				logInfo(`report: ${target}`)
				return
			}
			const report = renderHtmlReport(payload.summary)
			const target = path.join(runDir, 'report.html')
			await writeFile(target, report, 'utf-8')
			logInfo(`report: ${target}`)
		})
}
