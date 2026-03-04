import { afterEach, describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { rm } from 'node:fs/promises'
import path from 'node:path'

const createdRunIds: string[] = []

afterEach(async () => {
	for (const runId of createdRunIds.splice(0)) {
		await rm(path.resolve(process.cwd(), 'runs', runId), { recursive: true, force: true })
	}
})

const runCli = (args: string[]) => {
	return spawnSync('bun', ['run', 'src/cli.ts', ...args], {
		cwd: process.cwd(),
		stdio: 'pipe',
		encoding: 'utf-8',
		env: process.env,
	})
}

describe('agentgym CLI', () => {
	test('tasks list prints core catalog total', () => {
		const result = runCli(['tasks', 'list'])
		expect(result.status).toBe(0)
		const stdout = result.stdout
		expect(stdout).toContain('total: 40')
	})

	test('env validate accepts valid yaml', () => {
		const envPath = path.resolve(process.cwd(), 'tests/fixtures/custom-env.yaml')
		const result = runCli(['env', 'validate', envPath])
		expect(result.status).toBe(0)
		const stdout = result.stdout
		expect(stdout).toContain('valid:')
	})

	test('run command creates artifacts', () => {
		const result = runCli([
			'run',
			'--task',
			'memory-pref-1d',
			'--episodes',
			'1',
			'--parallel',
			'1',
			'--adapter',
			'mock',
			'--no-docker',
			'--run-label',
			'cli-test',
		])
		expect(result.status).toBe(0)
		const stdout = result.stdout
		expect(stdout).toContain('run_id:')
		const runId = stdout
			.split('\n')
			.find((line) => line.startsWith('run_id:'))
			?.split(':')
			.slice(1)
			.join(':')
			.trim()
		expect(runId).toBeTruthy()
		if (runId) {
			createdRunIds.push(runId)
		}
	})
})
