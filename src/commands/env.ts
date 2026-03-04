import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Command } from 'commander'
import { customEnvSchema, logInfo, parseCustomEnvYaml } from '../core'

export const registerEnvCommand = (program: Command): void => {
	const env = program.command('env').description('Custom environment tooling')

	env
		.command('validate')
		.description('Validate environment YAML against schema')
		.argument('<env-yaml>', 'Path to environment YAML file')
		.action(async (envPath: string) => {
			const absolute = path.resolve(process.cwd(), envPath)
			const parsed = await parseCustomEnvYaml(absolute)
			const result = customEnvSchema.safeParse(parsed)
			if (!result.success) {
				throw new Error(`invalid environment YAML: ${result.error.message}`)
			}
			logInfo(`valid: ${absolute}`)
			logInfo(`name: ${parsed.name}`)
			logInfo(`category: ${parsed.category}`)
			logInfo(`difficulty: ${parsed.difficulty.level}`)
			logInfo(`scoring_rules: ${parsed.scoring.length}`)
		})

	env
		.command('init')
		.description('Create starter YAML for custom environment')
		.argument('[output]', 'Output path', 'my-agentgym-env.yaml')
		.action(async (output: string) => {
			const templatePath = path.resolve(process.cwd(), 'src/templates/custom-env.yaml')
			const template = await readFile(templatePath, 'utf-8')
			const target = path.resolve(process.cwd(), output)
			await writeFile(target, template, 'utf-8')
			logInfo(`created: ${target}`)
		})
}
