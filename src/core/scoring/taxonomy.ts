import type { FailureMode } from '../types'

export const failureModeDescriptions: Record<FailureMode, string> = {
	retrieval_miss: 'Failed to retrieve relevant facts from context or memory.',
	hallucinated_fact: 'Generated fabricated or unsupported facts.',
	planning_error: 'Incorrect planning or step ordering.',
	tool_misuse: 'Used tools or APIs incorrectly.',
	policy_violation: 'Broke policy constraints.',
	timeout_or_cost_overrun: 'Exceeded configured time or cost budgets.',
	partial_completion: 'Returned incomplete task output.',
	none: 'No failure mode detected.',
}
