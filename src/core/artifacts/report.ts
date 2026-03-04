import type { RunSummary } from '../types'
import { asCurrency, asPercent, asScore, asSeconds } from '../utils/console'

const renderTaskRow = (summary: RunSummary, taskId: string): string => {
	const task = summary.tasks.find((item) => item.taskId === taskId)
	if (!task) {
		return ''
	}
	return `| ${task.taskId} | ${task.episodes} | ${asPercent(task.successRate)} | ${asScore(task.qualityMean)} | ${asCurrency(task.costMean)} | ${asSeconds(task.timeMean)} |`
}

export const renderMarkdownReport = (summary: RunSummary): string => {
	const lines = [
		`# AgentGym Report: ${summary.label}`,
		'',
		`- Run ID: ${summary.runId}`,
		`- Started: ${summary.startedAt}`,
		`- Ended: ${summary.endedAt}`,
		`- Episodes: ${summary.episodeCount}`,
		`- Adapter: ${summary.agent.id}`,
		'',
		'## Overall Metrics',
		'',
		`- Success rate: ${asPercent(summary.overall.successRate)}`,
		`- Quality: ${asScore(summary.overall.qualityMean)}/10`,
		`- Task success: ${asPercent(summary.overall.taskSuccessMean)}`,
		`- Cost/episode: ${asCurrency(summary.overall.costMean)}`,
		`- Time/episode: ${asSeconds(summary.overall.timeMean)}`,
		`- Reliability: ${asPercent(summary.overall.reliabilityMean)}`,
		'',
		'## Task Breakdown',
		'',
		'| Task | Episodes | Success | Quality | Cost | Time |',
		'|---|---:|---:|---:|---:|---:|',
	]
	for (const task of summary.tasks) {
		lines.push(renderTaskRow(summary, task.taskId))
	}
	lines.push('', '## Failure Modes', '')
	for (const [mode, count] of Object.entries(summary.overall.failureModeDistribution)) {
		if (count > 0) {
			lines.push(`- ${mode}: ${count}`)
		}
	}
	lines.push('')
	return lines.join('\n')
}

export const renderHtmlReport = (summary: RunSummary): string => {
	const taskRows = summary.tasks
		.map(
			(task) =>
				`<tr><td>${task.taskId}</td><td>${task.episodes}</td><td>${asPercent(task.successRate)}</td><td>${asScore(task.qualityMean)}</td><td>${asCurrency(task.costMean)}</td><td>${asSeconds(task.timeMean)}</td></tr>`,
		)
		.join('')
	const failures = Object.entries(summary.overall.failureModeDistribution)
		.filter(([, count]) => count > 0)
		.map(([mode, count]) => `<li><strong>${mode}</strong>: ${count}</li>`)
		.join('')

	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AgentGym Report ${summary.runId}</title>
  <style>
    body { font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif; margin: 32px; color: #112; background: linear-gradient(180deg, #f8fbff 0%, #eef4f8 100%); }
    h1, h2 { margin-bottom: 8px; }
    .card { background: white; border-radius: 14px; padding: 16px 18px; box-shadow: 0 10px 25px rgba(17, 34, 68, .08); margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border-bottom: 1px solid #d7e2ec; padding: 8px; text-align: left; }
    th { background: #f1f6fb; }
  </style>
</head>
<body>
  <div class="card">
    <h1>AgentGym Report: ${summary.label}</h1>
    <p><strong>Run:</strong> ${summary.runId}<br/><strong>Episodes:</strong> ${summary.episodeCount}<br/><strong>Adapter:</strong> ${summary.agent.id}</p>
  </div>
  <div class="card">
    <h2>Overall</h2>
    <ul>
      <li>Success rate: ${asPercent(summary.overall.successRate)}</li>
      <li>Quality: ${asScore(summary.overall.qualityMean)}/10</li>
      <li>Task success: ${asPercent(summary.overall.taskSuccessMean)}</li>
      <li>Cost/episode: ${asCurrency(summary.overall.costMean)}</li>
      <li>Time/episode: ${asSeconds(summary.overall.timeMean)}</li>
      <li>Reliability: ${asPercent(summary.overall.reliabilityMean)}</li>
    </ul>
  </div>
  <div class="card">
    <h2>Task Breakdown</h2>
    <table>
      <thead><tr><th>Task</th><th>Episodes</th><th>Success</th><th>Quality</th><th>Cost</th><th>Time</th></tr></thead>
      <tbody>${taskRows}</tbody>
    </table>
  </div>
  <div class="card">
    <h2>Failure Modes</h2>
    <ul>${failures || '<li>none</li>'}</ul>
  </div>
</body>
</html>`
}
