import { describe, expect, test } from 'bun:test'
import path from 'node:path'
import { parseCustomEnvYaml, toTaskEnvironment } from '../../src/core/environments'

describe('custom env loader', () => {
	test('parses YAML and builds runnable task', async () => {
		const envPath = path.resolve(process.cwd(), 'tests/fixtures/custom-env.yaml')
		const definition = await parseCustomEnvYaml(envPath)
		expect(definition.name).toBe('custom-memory-suite')
		const task = toTaskEnvironment(definition)
		expect(task.id).toContain('custom-custom-memory-suite-v1')
		const fixture = task.fixtureFactory(101, 1)
		expect(fixture.expectedFacts.length).toBe(2)
		expect(task.category).toBe('memory')
	})
})
