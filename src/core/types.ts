export type TaskCategory =
	| 'memory'
	| 'communication'
	| 'coding'
	| 'research'
	| 'admin'
	| 'multi-step'
	| 'tool-use'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface AdapterConfig {
	id: string
	name?: string
	provider?: string
	model?: string
	apiKeyEnvVar?: string
	endpoint?: string
	command?: string
	timeoutMs?: number
	metadata?: Record<string, unknown>
}

export interface EpisodeContext {
	runId: string
	runLabel: string
	taskId: string
	episode: number
	episodeSeed: number
	startedAt: string
	limits: RunLimits
}

export interface EnvObservation {
	prompt: string
	context: Record<string, unknown>
	constraints: string[]
	metadata?: Record<string, unknown>
	seedMessages?: string[]
}

export interface AgentAction {
	output: string
	toolCalls?: Array<{ tool: string; input?: unknown; output?: unknown }>
	memoryWrites?: Array<{ key: string; value: string; timestamp?: string }>
	interrupted?: boolean
	metadata?: Record<string, unknown>
}

export interface EpisodeSummary {
	taskId: string
	episode: number
	success: boolean
	metrics: ScoreDimensions
	failureModes: FailureMode[]
	durationMs: number
	costUsd: number
}

export interface AgentAdapter {
	readonly id: string
	init(config: AdapterConfig): Promise<void>
	startEpisode(ctx: EpisodeContext): Promise<void>
	act(input: EnvObservation): Promise<AgentAction>
	endEpisode(summary: EpisodeSummary): Promise<void>
	shutdown(): Promise<void>
}

export interface SetupStep {
	type: string
	value?: string
	path?: string
	args?: string[]
}

export interface ResetStrategy {
	mode: 'snapshot_restore' | 'git_reset' | 'fixture_restore' | 'custom'
	target?: string
	notes?: string
}

export interface EnvironmentFixture {
	id: string
	seed: number
	observation: EnvObservation
	expectedFacts: string[]
	authoritativeSource?: string
	metadata?: Record<string, unknown>
}

export interface GradeInput {
	fixture: EnvironmentFixture
	action: AgentAction
	durationMs: number
	costUsd: number
}

export interface DeterministicGrade {
	success: boolean
	quality: number
	taskSuccess: number
	reliability: number
	interventions: number
	failureModes: FailureMode[]
	dimensions?: Partial<MemoryDimensionScores>
	details?: Record<string, unknown>
}

export interface TaskEnvironment {
	id: string
	name: string
	category: TaskCategory
	description: string
	difficulty: Difficulty
	setup: SetupStep[]
	objective: string[]
	scoringDescription: string
	reset: ResetStrategy
	tags: string[]
	isMemoryScenario?: boolean
	fixtureFactory(seed: number, episode: number): EnvironmentFixture
	grade(input: GradeInput): DeterministicGrade
	llmRubric?: string
}

export interface RuntimeCaps {
	docker: boolean
	highIsolation: boolean
	deterministicClock: boolean
}

export interface RuntimeOptions {
	parallelism: number
	useDocker: boolean
	highIsolation: boolean
	maxEpisodeMs: number
	clockOffsetDays?: number
}

export interface EnvironmentRuntime {
	readonly caps: RuntimeCaps
	setupEpisode(task: TaskEnvironment, fixture: EnvironmentFixture): Promise<void>
	teardownEpisode(task: TaskEnvironment, fixture: EnvironmentFixture): Promise<void>
	reset(task: TaskEnvironment): Promise<void>
}

export type FailureMode =
	| 'retrieval_miss'
	| 'hallucinated_fact'
	| 'planning_error'
	| 'tool_misuse'
	| 'policy_violation'
	| 'timeout_or_cost_overrun'
	| 'partial_completion'
	| 'none'

export interface MemoryDimensionScores {
	recallAccuracy: number
	contextCompleteness: number
	temporalCorrectness: number
	conflictResolution: number
	precisionSafety: number
}

export interface ScoreDimensions {
	quality: number
	taskSuccess: number
	costUsd: number
	timeSec: number
	interventions: number
	reliability: number
	memory?: MemoryDimensionScores
}

export interface EpisodeTraceEvent {
	timestamp: string
	kind: 'observation' | 'action' | 'grade' | 'runtime'
	payload: Record<string, unknown>
}

export interface EpisodeResult {
	taskId: string
	episode: number
	seed: number
	success: boolean
	metrics: ScoreDimensions
	failureModes: FailureMode[]
	trace: EpisodeTraceEvent[]
	deterministic: DeterministicGrade
	rawAction: AgentAction
	fixture: EnvironmentFixture
}

export interface RunLimits {
	maxEpisodeMs: number
	maxCostUsd: number
	maxToolCalls: number
}

export interface RunRequest {
	runLabel: string
	taskIds: string[]
	episodes: number
	seed: number
	parallelism: number
	agentConfig: AdapterConfig
	runtime: RuntimeOptions
	limits: RunLimits
	enableLLMJudge: boolean
}

export interface TaskAggregate {
	taskId: string
	episodes: number
	successRate: number
	qualityMean: number
	taskSuccessMean: number
	costMean: number
	timeMean: number
	reliabilityMean: number
	interventionsMean: number
	failureModeDistribution: Record<FailureMode, number>
	memoryScore?: number
}

export interface RunSummary {
	runId: string
	label: string
	startedAt: string
	endedAt: string
	tasks: TaskAggregate[]
	overall: TaskAggregate
	episodeCount: number
	agent: AdapterConfig
	limits: RunLimits
}

export interface CompareMetricResult {
	metric: keyof Pick<
		ScoreDimensions,
		'quality' | 'taskSuccess' | 'costUsd' | 'timeSec' | 'reliability'
	>
	meanDelta: number
	effectSize: number
	pValue: number
	ci95: [number, number]
	probabilityImprovement: number
	inconclusive: boolean
}

export interface CompareSummary {
	taskId: string
	episodes: number
	runA: RunSummary
	runB: RunSummary
	metrics: CompareMetricResult[]
	recommendation: string
}

export interface BenchmarkSuite {
	id: string
	name: string
	description: string
	taskIds: string[]
	defaultEpisodes: number
}

export interface CiSuiteTask {
	id: string
	episodes: number
}

export interface CiThresholds {
	quality?: number
	successRate?: number
	reliability?: number
	maxCostUsd?: number
	maxTimeSec?: number
}

export interface CiSuiteDefinition {
	name: string
	seed?: number
	tasks: CiSuiteTask[]
	thresholds: CiThresholds
}

export interface CustomEnvDefinition {
	name: string
	version: number
	category: TaskCategory
	description: string
	setup: Array<Record<string, unknown>>
	objective: string[]
	scoring: Array<{
		type: string
		values?: string[]
		weight: number
		rubric?: string
	}>
	difficulty: {
		level: Difficulty
	}
	reset: {
		mode: ResetStrategy['mode']
		snapshot?: string
	}
}

export interface RunArtifacts {
	rootDir: string
	resultsPath: string
	reportMdPath: string
	reportHtmlPath: string
	episodesDir: string
}

export interface RunWithArtifacts {
	summary: RunSummary
	episodes: EpisodeResult[]
	artifacts: RunArtifacts
}
