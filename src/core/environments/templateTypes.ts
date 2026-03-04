import type { Difficulty, ResetStrategy, TaskCategory } from '../types'

export interface TaskTemplateData {
	id: string
	name: string
	category: TaskCategory
	difficulty: Difficulty
	description: string
	objective: string[]
	scoringDescription: string
	setup: Array<{ type: string; value?: string; path?: string; args?: string[] }>
	reset: ResetStrategy
	tags: string[]
	factBank: string[]
	expectedCount?: number
	emptyRecall?: boolean
	memoryFocused?: boolean
	metadata?: Record<string, unknown>
	queryPrompt?: string
	seedMessages?: string[]
}
