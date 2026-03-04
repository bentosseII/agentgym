import { z } from 'zod'

export const customEnvSchema = z.object({
	name: z.string().min(1),
	version: z.number().int().positive(),
	category: z.enum([
		'memory',
		'communication',
		'coding',
		'research',
		'admin',
		'multi-step',
		'tool-use',
	]),
	description: z.string().min(1),
	setup: z.array(z.record(z.string(), z.unknown())).min(1),
	objective: z.array(z.string().min(1)).min(1),
	scoring: z
		.array(
			z.object({
				type: z.string().min(1),
				values: z.array(z.string()).optional(),
				weight: z.number().positive(),
				rubric: z.string().optional(),
			}),
		)
		.min(1),
	difficulty: z.object({
		level: z.enum(['easy', 'medium', 'hard']),
	}),
	reset: z.object({
		mode: z.enum(['snapshot_restore', 'git_reset', 'fixture_restore', 'custom']),
		snapshot: z.string().optional(),
	}),
})

export type ParsedCustomEnv = z.infer<typeof customEnvSchema>
