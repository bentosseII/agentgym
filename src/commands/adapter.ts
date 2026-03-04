import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Command } from 'commander'
import { listAdapters, logInfo } from '../core'

export const registerAdapterCommand = (program: Command): void => {
	const adapter = program.command('adapter').description('Adapter utilities')

	adapter
		.command('list')
		.description('List built-in adapters')
		.action(() => {
			for (const id of listAdapters()) {
				logInfo(id)
			}
		})

	adapter
		.command('init')
		.description('Scaffold custom adapter module')
		.argument('[output]', 'Output file path', 'agentgym.adapter.ts')
		.action(async (output: string) => {
			const templatePath = path.resolve(process.cwd(), 'src/templates/custom-adapter.ts')
			const template = await readFile(templatePath, 'utf-8')
			const target = path.resolve(process.cwd(), output)
			await writeFile(target, template, 'utf-8')
			logInfo(`created: ${target}`)
		})
}
