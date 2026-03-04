import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AdapterConfig, AgentAdapter } from '../types'
import { AnthropicAdapter } from './anthropicAdapter'
import { MockAdapter } from './mockAdapter'
import { OpenAIAdapter } from './openaiAdapter'
import { OpenClawAdapter } from './openclawAdapter'
import { ShellAdapter } from './shellAdapter'

export type AdapterFactory = () => AgentAdapter

const builtInFactories: Record<string, AdapterFactory> = {
	mock: () => new MockAdapter(),
	anthropic: () => new AnthropicAdapter(),
	openai: () => new OpenAIAdapter(),
	'raw-api': () => new OpenAIAdapter('raw-api'),
	openclaw: () => new OpenClawAdapter(),
	codex: () => new ShellAdapter('codex'),
	'claude-code': () => new ShellAdapter('claude-code'),
	langchain: () => new ShellAdapter('langchain'),
	crewai: () => new ShellAdapter('crewai'),
	shell: () => new ShellAdapter('shell'),
}

export const listAdapters = (): string[] => Object.keys(builtInFactories).sort()

const toFileUrl = (modulePath: string): string => {
	if (modulePath.startsWith('file://')) {
		return modulePath
	}
	const absolute = path.isAbsolute(modulePath)
		? modulePath
		: path.resolve(process.cwd(), modulePath)
	return pathToFileURL(absolute).href
}

const loadCustomFactory = async (modulePath: string): Promise<AdapterFactory> => {
	const moduleUrl = toFileUrl(modulePath)
	const loaded = (await import(moduleUrl)) as {
		default?: AdapterFactory
		createAdapter?: AdapterFactory
	}
	if (typeof loaded.default === 'function') {
		return loaded.default
	}
	if (typeof loaded.createAdapter === 'function') {
		return loaded.createAdapter
	}
	throw new Error(
		`custom adapter module ${modulePath} must export default() or createAdapter() returning AgentAdapter`,
	)
}

export const createAdapter = async (
	config: AdapterConfig,
	customModule?: string,
): Promise<AgentAdapter> => {
	let factory = builtInFactories[config.id]
	if (!factory && customModule) {
		factory = await loadCustomFactory(customModule)
	}
	if (!factory) {
		throw new Error(
			`unknown adapter '${config.id}'. Built-in adapters: ${listAdapters().join(', ')}.`,
		)
	}
	const adapter = factory()
	await adapter.init(config)
	return adapter
}
