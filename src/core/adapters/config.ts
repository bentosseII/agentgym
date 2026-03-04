import { readFile } from 'node:fs/promises'
import YAML from 'yaml'
import { z } from 'zod'
import type { AdapterConfig } from '../types'

const adapterConfigSchema = z.object({
	id: z.string().min(1),
	name: z.string().optional(),
	provider: z.string().optional(),
	model: z.string().optional(),
	apiKeyEnvVar: z.string().optional(),
	endpoint: z.string().url().optional(),
	command: z.string().optional(),
	timeoutMs: z.number().int().positive().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
})

export const parseAdapterConfig = async (filePath: string): Promise<AdapterConfig> => {
	const raw = await readFile(filePath, 'utf-8')
	const parsed = YAML.parse(raw)
	const result = adapterConfigSchema.safeParse(parsed)
	if (!result.success) {
		throw new Error(`invalid adapter config ${filePath}: ${result.error.message}`)
	}
	return result.data
}
