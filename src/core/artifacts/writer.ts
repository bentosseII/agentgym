import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { EpisodeResult, RunArtifacts, RunSummary } from '../types'
import { ensureDir, writeJson } from '../utils/fs'
import { renderHtmlReport, renderMarkdownReport } from './report'

export const prepareArtifacts = async (
	runId: string,
	baseRunsDir = 'runs',
): Promise<RunArtifacts> => {
	const rootDir = path.resolve(process.cwd(), baseRunsDir, runId)
	const artifacts: RunArtifacts = {
		rootDir,
		resultsPath: path.join(rootDir, 'results.json'),
		reportMdPath: path.join(rootDir, 'report.md'),
		reportHtmlPath: path.join(rootDir, 'report.html'),
		episodesDir: path.join(rootDir, 'episodes'),
	}
	await ensureDir(artifacts.episodesDir)
	return artifacts
}

const episodeTracePath = (artifacts: RunArtifacts, episode: EpisodeResult): string => {
	const file = `${episode.taskId}-ep${String(episode.episode).padStart(3, '0')}.trace.jsonl`
	return path.join(artifacts.episodesDir, file)
}

const formatJsonLines = (events: EpisodeResult['trace']): string =>
	`${events.map((event) => JSON.stringify(event)).join('\n')}\n`

export const writeRunArtifacts = async (
	artifacts: RunArtifacts,
	summary: RunSummary,
	episodes: EpisodeResult[],
): Promise<void> => {
	await writeJson(artifacts.resultsPath, {
		summary,
		episodes,
	})
	for (const episode of episodes) {
		await writeFile(episodeTracePath(artifacts, episode), formatJsonLines(episode.trace), 'utf-8')
	}
	await writeFile(artifacts.reportMdPath, renderMarkdownReport(summary), 'utf-8')
	await writeFile(artifacts.reportHtmlPath, renderHtmlReport(summary), 'utf-8')
}
