#!/usr/bin/env node
import { Command } from 'commander'
import pkg from '../package.json'
import { registerAdapterCommand } from './commands/adapter'
import { registerBenchmarkCommand } from './commands/benchmark'
import { registerCiCommand } from './commands/ci'
import { registerCompareCommand } from './commands/compare'
import { registerEnvCommand } from './commands/env'
import { registerReplayCommand } from './commands/replay'
import { registerReportCommand } from './commands/report'
import { registerRunCommand } from './commands/run'
import { registerTasksCommand } from './commands/tasks'

const program = new Command()

program
	.name('agentgym')
	.description('CLI framework for testing and benchmarking AI agents on realistic tasks')
	.version(pkg.version)

registerRunCommand(program)
registerCompareCommand(program)
registerBenchmarkCommand(program)
registerCiCommand(program)
registerTasksCommand(program)
registerEnvCommand(program)
registerReplayCommand(program)
registerReportCommand(program)
registerAdapterCommand(program)

program.showHelpAfterError().configureOutput({
	outputError: (str, write) => write(str),
})

const execute = async (): Promise<void> => {
	try {
		if (process.argv.length <= 2) {
			program.outputHelp()
			return
		}
		await program.parseAsync(process.argv)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		process.stderr.write(`agentgym error: ${message}\n`)
		process.exit(1)
	}
}

void execute()
