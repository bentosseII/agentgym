import type {
	AgentAction,
	DeterministicGrade,
	EnvironmentFixture,
	FailureMode,
	MemoryDimensionScores,
} from '../types'
import { clamp } from '../utils/math'

const normalize = (value: string): string => value.toLowerCase()

const containsFact = (text: string, fact: string): boolean => {
	const candidate = normalize(text)
	return candidate.includes(normalize(fact))
}

const detectHallucination = (output: string): boolean => {
	const lowered = normalize(output)
	return (
		lowered.includes('invented detail') ||
		lowered.includes('synthetic-fact-') ||
		lowered.includes('made up') ||
		lowered.includes('guessing')
	)
}

const scoreTemporal = (fixture: EnvironmentFixture, output: string): number => {
	const latestFact = fixture.metadata?.latestFact
	if (typeof latestFact !== 'string' || latestFact.length === 0) {
		return 9
	}
	return containsFact(output, latestFact) ? 10 : 3
}

const scoreConflict = (fixture: EnvironmentFixture, output: string): number => {
	const changedFrom = fixture.metadata?.changedFrom
	const changedTo = fixture.metadata?.changedTo
	if (typeof changedTo !== 'string') {
		return 9
	}
	const hasNew = containsFact(output, changedTo)
	const hasOld = typeof changedFrom === 'string' ? containsFact(output, changedFrom) : false
	if (hasNew && hasOld) {
		return 8
	}
	if (hasNew) {
		return 10
	}
	return 2
}

export const computeMemoryDimensions = (
	fixture: EnvironmentFixture,
	action: AgentAction,
	recallRate: number,
	hallucinated: boolean,
): MemoryDimensionScores => {
	const output = action.output
	const precisionSafety = hallucinated ? 2.5 : 9.5
	return {
		recallAccuracy: clamp(recallRate * 10, 0, 10),
		contextCompleteness: clamp(
			(recallRate * (fixture.expectedFacts.length >= 3 ? 9.2 : 9.8)) / 1,
			0,
			10,
		),
		temporalCorrectness: scoreTemporal(fixture, output),
		conflictResolution: scoreConflict(fixture, output),
		precisionSafety,
	}
}

const detectFailureModes = (
	recallRate: number,
	hallucinated: boolean,
	durationMs: number,
	costUsd: number,
): FailureMode[] => {
	const failures: FailureMode[] = []
	if (recallRate < 0.5) {
		failures.push('retrieval_miss')
	}
	if (hallucinated) {
		failures.push('hallucinated_fact')
	}
	if (durationMs > 60_000 || costUsd > 0.5) {
		failures.push('timeout_or_cost_overrun')
	}
	if (recallRate > 0 && recallRate < 1) {
		failures.push('partial_completion')
	}
	if (failures.length === 0) {
		failures.push('none')
	}
	return failures
}

export const gradeByFactCoverage = (
	fixture: EnvironmentFixture,
	action: AgentAction,
	durationMs: number,
	costUsd: number,
	memoryFocused: boolean,
): DeterministicGrade => {
	const output = action.output ?? ''
	const expectedFacts = fixture.expectedFacts
	if (expectedFacts.length === 0) {
		const unknownSignals = ['unknown', 'not discussed', 'no memory', 'insufficient signal']
		const correctUnknown = unknownSignals.some((signal) => normalize(output).includes(signal))
		const hallucinated = detectHallucination(output)
		const quality = correctUnknown && !hallucinated ? 9.5 : 2.5
		return {
			success: correctUnknown && !hallucinated,
			quality,
			taskSuccess: correctUnknown ? 1 : 0,
			reliability: 1,
			interventions: 0,
			failureModes: correctUnknown ? ['none'] : ['hallucinated_fact'],
			dimensions: memoryFocused
				? {
						recallAccuracy: correctUnknown ? 10 : 0,
						contextCompleteness: correctUnknown ? 10 : 0,
						temporalCorrectness: 9,
						conflictResolution: 9,
						precisionSafety: correctUnknown ? 10 : 0,
					}
				: undefined,
		}
	}

	const matched = expectedFacts.filter((fact) => containsFact(output, fact)).length
	const recallRate = matched / expectedFacts.length
	const hallucinated = detectHallucination(output)
	const taskSuccess = recallRate
	const quality = clamp(2 + recallRate * 8 - (hallucinated ? 2 : 0), 0, 10)
	const reliability = durationMs > 60_000 ? 0.8 : 1
	const interventions = hallucinated ? 1 : 0
	const failureModes = detectFailureModes(recallRate, hallucinated, durationMs, costUsd)

	return {
		success: recallRate >= 0.8 && !hallucinated,
		quality,
		taskSuccess,
		reliability,
		interventions,
		failureModes,
		dimensions: memoryFocused
			? computeMemoryDimensions(fixture, action, recallRate, hallucinated)
			: undefined,
		details: {
			matchedFacts: matched,
			expectedFacts: expectedFacts.length,
			recallRate,
			hallucinated,
		},
	}
}
