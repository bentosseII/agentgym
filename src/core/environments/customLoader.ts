import { readFile } from 'node:fs/promises'
import YAML from 'yaml'
import type { CustomEnvDefinition, EnvironmentFixture, TaskEnvironment } from '../types'
import { gradeByFactCoverage } from './grading'
import { customEnvSchema, type ParsedCustomEnv } from './schema'

const slugify = (value: string): string =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')

const extractSetup = (setup: ParsedCustomEnv['setup']) => {
	return setup.map((entry) => {
		const [type, value] = Object.entries(entry)[0] ?? ['custom_setup', undefined]
		return {
			type,
			value: typeof value === 'string' ? value : JSON.stringify(value),
		}
	})
}

const expectedFactsFromRule = (definition: ParsedCustomEnv): string[] => {
	const factSet = new Set<string>()
	for (const rule of definition.scoring) {
		for (const value of rule.values ?? []) {
			factSet.add(value)
		}
	}
	return [...factSet]
}

export const parseCustomEnvYaml = async (envPath: string): Promise<CustomEnvDefinition> => {
	const raw = await readFile(envPath, 'utf-8')
	const parsed = YAML.parse(raw)
	const result = customEnvSchema.safeParse(parsed)
	if (!result.success) {
		throw new Error(`invalid environment YAML ${envPath}: ${result.error.message}`)
	}
	const payload = result.data
	return {
		name: payload.name,
		version: payload.version,
		category: payload.category,
		description: payload.description,
		setup: payload.setup,
		objective: payload.objective,
		scoring: payload.scoring,
		difficulty: payload.difficulty,
		reset: payload.reset,
	}
}

export const toTaskEnvironment = (definition: CustomEnvDefinition): TaskEnvironment => {
	const expectedFacts = expectedFactsFromRule(definition as ParsedCustomEnv)
	const id = `custom-${slugify(definition.name)}-v${definition.version}`
	return {
		id,
		name: definition.name,
		category: definition.category,
		description: definition.description,
		difficulty: definition.difficulty.level,
		setup: extractSetup(definition.setup as ParsedCustomEnv['setup']),
		objective: definition.objective,
		scoringDescription: definition.scoring.map((item) => item.type).join(', '),
		reset: {
			mode: definition.reset.mode,
			target: definition.reset.snapshot,
		},
		tags: ['custom-env'],
		fixtureFactory(seed: number, episode: number): EnvironmentFixture {
			return {
				id: `${id}:${episode}`,
				seed,
				expectedFacts,
				observation: {
					prompt: [
						`Custom Task: ${definition.name}`,
						`Description: ${definition.description}`,
						`Objective: ${definition.objective.join(', ')}`,
					].join('\n'),
					constraints: ['Use only grounded facts', 'Avoid fabricated details'],
					context: {
						taskId: id,
						scoring: definition.scoring,
						expectedFacts,
					},
				},
			}
		},
		grade({ fixture, action, durationMs, costUsd }) {
			const memoryFocused = definition.category === 'memory'
			return gradeByFactCoverage(fixture, action, durationMs, costUsd, memoryFocused)
		},
		llmRubric: definition.scoring.find((item) => item.type === 'llm_rubric')?.rubric,
	}
}
