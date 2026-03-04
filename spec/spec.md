# AgentGym — Product Spec (v1)

## Overview

AgentGym is a CLI-first testing, validation, and optimization framework for AI agents.

**One line:** OpenAI Gym for real-world agent tasks.

Instead of judging agents with one-off vibe checks, AgentGym runs them through **50–1000 realistic episodes** (email triage, memory recall, coding tasks, scheduling, research, tool chains) and outputs a measurable scorecard.

### Vision
Make agent quality measurable, improvable, and comparable.

### Positioning
- **Not** an academic benchmark suite.
- **Not** only a leaderboard.
- **Yes** to practical, reproducible evaluation of production-like agent workflows.

### Primary users
1. Solo builders shipping personal/workflow agents
2. Startup teams deploying internal copilots/automation agents
3. Platform teams maintaining shared agent frameworks
4. Researchers/practitioners tuning memory/retrieval/tooling behavior

---

## Problem

Today, most agent teams test like this:
1. change prompt/config/tool
2. run one task once
3. decide by feeling

That workflow is noisy, biased, and non-reproducible.

### Core pain points
- No baseline or repeatable episodes
- No confidence interval for “better” vs random variance
- No regression safety net before deployment
- No structured way to evaluate memory quality over time
- No shared benchmark language across teams/frameworks

### Why now
Agent systems are becoming persistent and stateful (memory, tools, background jobs, multi-step plans). Their failure modes are subtle and cumulative. We need software-style testing discipline for agent behavior.

---

## Product Goals & Non-Goals

### Goals (v1)
1. Run realistic evaluation episodes locally or in CI with deterministic setup/reset.
2. Support framework-agnostic adapters so users can test any agent stack.
3. Deliver trustworthy scoring (quality, success, cost, time, reliability).
4. Make config comparisons statistically meaningful (A/B testing).
5. Ship a strong default environment library, especially memory testing.

### Non-goals (v1)
- Full autonomous online RL with self-modifying production systems
- Universal correctness guarantees for subjective tasks
- Live internet benchmark parity across all providers/models

---

## Core Use Cases

## 1) Agent Validation — “Is my agent actually good at this?”

### User flow
1. Select a task/environment (`email-triage`).
2. Choose episode count (`N=100`) and seed strategy.
3. Run with chosen agent adapter/config.
4. Receive scorecard + failure clusters + replay traces.

### Inputs
- Task/environment
- Agent config + adapter
- Episode count
- Optional constraints (cost cap, timeout, max tool calls)

### Outputs
- Success rate
- Quality score (1–10)
- Mean/median cost
- Mean/median completion time
- Failure mode distribution
- Top replay examples (best/worst episodes)

### Example
> “Email triage agent: quality 7.8/10 over 100 synthetic inboxes; 86% SLA adherence; primary failures: over-archiving and missed VIP escalation.”

---

## 2) Config A/B Testing — “Is this change better or worse?”

**This is the killer use case.**

### User flow
1. Pick a focused suite (e.g., `memory-recall-medium`, 50 episodes).
2. Run config A and config B against same seeded episodes.
3. Compute effect size + significance + per-dimension diffs.
4. Make decision from evidence.

### Typical variables
- Memory backend (vector/full-text/hybrid/graph)
- Prompt variants
- Tool policies
- Model choice
- Summarization/compaction frequency

### Outputs
- A vs B delta by metric (quality, success, cost, time)
- 95% confidence interval
- p-value/equivalent Bayesian probability of improvement
- Segment analysis (where B helps/hurts)

### Example
> “Memory config B outperforms A by +1.2 quality points (95% CI: +0.6 to +1.8), +14% cross-session recall, +$0.03/episode cost. Recommendation: adopt B for memory-critical workflows.”

---

## 3) Regression Testing — “Did my change break anything?”

### User flow
1. Define regression suite (mix of memory, communication, coding).
2. Set minimum thresholds by metric and category.
3. Run in CI for every PR/release.
4. Block merge/deploy on threshold breach.

### Outputs
- Pass/fail gate
- Drift report vs last baseline
- “Improved X, degraded Y” summary

### Example
> “Prompt update improved coding tasks +12% but degraded email triage quality by 8%; gate failed.”

---

## 4) Training/Optimization — “Make my agent better automatically”

### v1 scope
- Grid search / random search over config space
- Pareto front for quality vs cost vs time
- Automatic best-candidate suggestion

### v1.5+ direction
- Bandit/Bayesian optimization
- RL-style loops with reward from evaluator

### Output
- Ranked candidate configs
- Trade-off frontier
- Best config per objective profile (cheap/fast/high-quality)

---

## 5) Benchmarking — “How does my setup compare?”

### User flow
1. Run `agentgym benchmark` on standard suite.
2. Optionally publish anonymized result to leaderboard.
3. Compare against similar agents/frameworks/tasks.

### Output
- Standardized benchmark profile
- Percentile ranking by category
- Compatibility with **AgentMark (spec 04)** and **Ben’s Benchmark (spec 03)** through shared environments/scoring contracts

---

## Task Environment Library (v1)

Target: **40 environments** across 7 categories.

Each environment includes:
- **Setup**
- **Objective**
- **Scoring function** (automated + optional LLM judge)
- **Difficulty** (Easy/Medium/Hard)
- **Reset strategy**

## Category summary
- Memory & Recall: 12
- Communication: 7
- Coding: 6
- Research: 5
- Admin: 4
- Multi-step: 3
- Tool Use: 3

Total = **40**

---

## Memory & Recall (12 environments, deep focus)

| ID | Setup | Objective | Scoring | Difficulty | Reset |
|---|---|---|---|---|---|
| memory-pref-1d | Inject one-time preference; 1-day simulated gap | Recall exact preference on request | exact match + confidence calibration | E/M/H by distractors | restore memory DB snapshot |
| memory-pref-7d | Same as above, 7-day gap | Recall after long delay | exact + hallucination penalty | M/H | restore snapshot + seed time |
| memory-decision-context | Conversation includes decision + who/why/when | Recall full decision context | key-fact tuple completeness (4-tuple) | M/H | replay transcript seed |
| memory-multi-convo-merge | Facts split across 3 sessions | Synthesize coherent answer | fact coverage + source consistency | M/H | reset session graph |
| memory-similar-items | Two similar entities (e.g., Alex project A/B) | Distinguish correctly | confusion matrix | M/H | reset entities + embeddings |
| memory-conflict-update | Preference changes later | Return latest, acknowledge change | recency correctness + conflict handling | M/H | restore temporal log |
| memory-under-distraction | 100-message topic drift before query | Retrieve relevant old fact | retrieval precision@k + final answer | M/H | deterministic convo generator |
| memory-numeric-accuracy | Dates/amounts/names seeded | Recall numerics exactly | numeric exactness + tolerance bands | E/M/H | reset fact ledger |
| memory-long-thread-200 | 200+ message conversation | Pull targeted details | answer F1 + latency | M/H | restore long-thread fixture |
| memory-vague-query | Partial cue (“that thing last week”) | Infer target memory safely | recall + uncertainty handling | H | restore ambiguity set |
| memory-negative-recall | Asked about never-discussed topic | Correctly say unknown | true negative rate | E/M/H | restore convo baseline |
| memory-composite-reasoning | Combine 3 memories into one recommendation | Multi-memory synthesis | composite fact + reasoning coherence | H | restore multi-source state |

---

## Communication (7)

| ID | Setup | Objective | Scoring | Difficulty | Reset |
|---|---|---|---|---|---|
| email-triage-basic | 50-email synthetic inbox | Categorize + prioritize + label | macro-F1 + SLA | E/M/H | reset mailbox fixture |
| email-reply-drafting | Inbox with nuanced customer tones | Draft safe, useful replies | rubric judge + policy checks | E/M/H | reset inbox + thread IDs |
| email-followup-tracker | Pending conversations with deadlines | Identify and schedule follow-ups | deadline recall + correctness | M/H | reset tracker DB |
| meeting-scheduling | Multi-party availability + constraints | Propose feasible schedule | hard-constraint satisfaction | E/M/H | reset calendars |
| stakeholder-update | Raw notes and metrics | Produce status update email | factuality + structure + tone | E/M/H | restore notes snapshot |
| escalation-detection | Mixed priority support emails | Escalate critical items | recall at high severity + false positives | M/H | reset inbox |
| comms-policy-compliance | Messages with policy traps | Respond while obeying policy | violation count + quality | M/H | restore policy set |

## Coding (6)

| ID | Setup | Objective | Scoring | Difficulty | Reset |
|---|---|---|---|---|---|
| code-bugfix-small | Repo with seeded bug + tests | Fix failing test | tests pass + diff quality | E/M/H | git hard reset |
| code-pr-review | PR diff with intentional issues | Review and flag issues | precision/recall vs gold review | M/H | reset PR fixture |
| code-feature-mini | Small spec + skeleton repo | Implement feature | acceptance tests + style rubric | M/H | restore repo snapshot |
| code-test-writing | Untested module | Write meaningful tests | mutation score + coverage delta | M/H | reset repo |
| code-refactor-safe | messy code + baseline tests | Refactor without regressions | tests + complexity improvement | M/H | restore repo |
| code-debug-trace | logs + failing behavior | Identify root cause + patch | root-cause correctness + fix | H | reset logs/code snapshot |

## Research (5)

| ID | Setup | Objective | Scoring | Difficulty | Reset |
|---|---|---|---|---|---|
| research-brief | Topic + source corpus | Produce concise brief | citation validity + completeness | E/M/H | restore corpus snapshot |
| competitive-matrix | 5 vendor docs | Build comparison matrix | field completeness + factuality | M/H | reset docs set |
| fact-check-claims | Article with mixed claims | Verify and classify claims | claim verdict accuracy | M/H | reset source pack |
| longform-summary | 30+ page report | Executive summary | key-point recall + compression | E/M/H | restore report |
| synthesis-opinion | Contradictory sources | Balanced recommendation | stance justification quality | H | restore source bundle |

## Admin (4)

| ID | Setup | Objective | Scoring | Difficulty | Reset |
|---|---|---|---|---|---|
| file-organization | Messy folder tree | Reorganize by rules | rule adherence + idempotence | E/M/H | restore FS snapshot |
| expense-categorization | CSV receipts | Categorize accurately | accuracy + confidence | E/M/H | reset CSV |
| data-entry-validation | forms with noise | Enter clean structured data | field error rate | E/M/H | reset dataset |
| duplicate-resolution | contacts/tasks duplicates | Merge safely | merge precision + data retention | M/H | restore DB snapshot |

## Multi-step (3)

| ID | Setup | Objective | Scoring | Difficulty | Reset |
|---|---|---|---|---|---|
| plan-execute-5step | task requiring 5+ dependent steps | Complete end-to-end workflow | step completion + ordering | M/H | restore world state |
| error-recovery-chain | API/tool failures injected mid-flow | Recover and finish | recovery success + retries | H | reset fault injector |
| long-horizon-task | 20–30 min composite objective | Maintain plan coherence | completion + drift score | H | reset all fixtures |

## Tool Use (3)

| ID | Setup | Objective | Scoring | Difficulty | Reset |
|---|---|---|---|---|---|
| api-chaining | 3 APIs with dependencies | Fetch-transform-submit correctly | schema validity + latency | M/H | reset mock services |
| auth-refresh | expiring token flow | Re-auth and continue | auth success + secure handling | M/H | reset auth server state |
| retry-backoff | flaky endpoint (429/500) | Apply correct retry strategy | success + policy compliance | M/H | reset failure sequence |

---

## Memory Testing Deep Dive (Primary wedge)

## The problem
Persistent-memory agents are currently tuned by intuition. Teams tweak memory settings, chat for a bit, and guess if it improved. This causes silent regressions and weeks of wasted experimentation.

AgentGym makes memory performance measurable, segmentable, and optimizable.

## Memory scenario pack (18 scenarios)

1. Preference mentioned once, recall after 1 day
2. Preference mentioned once, recall after 7 days
3. Decision recall with full context (who/what/why/when)
4. Fact repeated across multiple sessions; must consolidate
5. Distinguish similar memories (two people, two projects, similar wording)
6. Updated preference supersedes old preference
7. Contradictory info from different sources; prioritize authoritative source
8. Recall under heavy distraction/topic drift
9. Numeric fidelity (dates, prices, percentages, IDs)
10. Entity fidelity (names, roles, company/project mapping)
11. Long-thread retrieval (200+ messages)
12. Vague prompt retrieval (“that thing from last week”)
13. Priority memory vs casual memory selection
14. Cross-session recall (Session A fact retrieved in Session B)
15. Temporal ordering (what came first / latest status)
16. Negative recall (correctly report absence of memory)
17. Composite recall (combine facts from 3 separate conversations)
18. Multi-hop memory reasoning (recall fact + apply policy/constraint)

## Scoring framework for memory

### Dimension scores (0–10)
- **Recall Accuracy**: factual correctness of retrieved memory
- **Context Completeness**: includes relevant who/what/why/when
- **Temporal Correctness**: correct recency/order handling
- **Conflict Resolution**: handles updates/contradictions correctly
- **Precision/Safety**: avoids fabricated memory

### Metrics
- Exact-match rate (for atomic facts)
- Token-level F1 (for open-form responses)
- Hallucinated-memory rate
- Recency-error rate
- False-positive recall rate (claiming memory that does not exist)

### Memory Score (example composite)
`MemoryScore = 0.35*Accuracy + 0.20*Completeness + 0.15*Temporal + 0.15*Conflict + 0.15*Precision`

## A/B variables for memory system
- Retrieval strategy: vector vs full-text vs hybrid vs graph
- Embedding model
- Chunk size/overlap
- Memory compaction frequency (hourly/daily/event-based)
- Summarized vs verbatim retention ratio
- Recency weighting function
- Relevance threshold / top-k retrieval
- Context injection budget (tokens)
- Memory file/index topology (single, daily, topic, graph)
- Metadata richness (timestamps, source IDs, priority tags)

## Example output

> Your memory system scores **7.2/10** overall.
> Strengths: recent recall **9.1**, decision context **8.3**.
> Weaknesses: cross-session recall **4.2**, temporal ordering **5.1**.
> Recommendation: add session-link indexing and strict timestamp metadata; increase cross-session retrieval weight by +20%.

---

## Architecture

## CLI Design

```bash
# Run episodes on one task
agentgym run --task email-triage --episodes 50 --agent ./my-agent-config.yaml

# Compare two configs on same seeded episodes
agentgym compare --task memory-recall --episodes 100 \
  --config-a ./memory-v1.yaml --config-b ./memory-v2.yaml

# Standard benchmark suite
agentgym benchmark --agent ./my-agent-config.yaml

# CI gate
agentgym ci --suite ./my-test-suite.yaml --threshold 7.5
```

### Additional CLI commands (v1)
- `agentgym tasks list`
- `agentgym tasks inspect <task-id>`
- `agentgym env validate <env.yaml>`
- `agentgym replay <run-id> --episode <n>`
- `agentgym report <run-id> --format html|json|md`

### Output artifacts
- `runs/<run-id>/results.json`
- `runs/<run-id>/episodes/*.trace.jsonl`
- `runs/<run-id>/report.md`
- `runs/<run-id>/report.html`

---

## Agent Adapter System

### Requirements
- Framework-agnostic interface
- Supports sync and streaming action loops
- Supports tool-calling, memory read/write hooks, and interruption states

### Adapter contract (conceptual)

```ts
interface AgentAdapter {
  init(config: AdapterConfig): Promise<void>
  startEpisode(ctx: EpisodeContext): Promise<void>
  act(input: EnvObservation): Promise<AgentAction>
  endEpisode(summary: EpisodeSummary): Promise<void>
  shutdown(): Promise<void>
}
```

### Built-in adapters (v1)
- OpenClaw
- Claude Code
- Codex
- LangChain (generic runnable wrapper)
- CrewAI
- Raw OpenAI/Anthropic-compatible API adapter

### Custom adapter UX
- `agentgym adapter init`
- scaffold + test harness + local mock environment
- conformance tests to ensure reliable runtime behavior

---

## Environment Runtime

### Isolation
- Default: Docker containers
- Optional high-isolation mode: Firecracker microVM

### Determinism controls
- Episode seeds
- Frozen synthetic datasets
- Mock external APIs with reproducible responses
- Controlled clock (simulated time shifts, crucial for memory tests)

### Execution model
- Orchestrator schedules episodes to workers
- Parallelism configurable (`--parallel N`)
- Per-episode max time, cost, and tool call limits

### Reset strategy
- Snapshot/restore per environment
- Immutable fixture packs
- Fast reset target: <2s median for lightweight tasks

---

## Scoring System

### Score dimensions
1. **Quality** (1–10)
2. **Task Success** (%)
3. **Cost** ($/episode)
4. **Time** (sec/episode)
5. **Interventions** (manual recoveries, 0–5)
6. **Reliability** (% episodes completed without fatal error)

### Scoring stack
- Deterministic task-specific graders first
- Optional LLM-as-judge rubric for subjective quality
- Judge calibration set + inter-rater checks
- Confidence intervals on aggregate metrics

### A/B statistical analysis
- Paired episode analysis with shared seeds
- Report effect size + CI + significance
- Flag inconclusive results and recommend more episodes

### Failure mode taxonomy (standardized)
- Retrieval miss
- Hallucinated fact
- Planning error
- Tool misuse
- Policy violation
- Timeout / cost overrun
- Partial completion

---

## Custom Environments

Users can create YAML-defined environments or code-based environments.

### YAML example

```yaml
name: my-memory-test
version: 1
category: memory

description: Test if agent recalls project decisions from conversation history
setup:
  - inject_conversation: ./test-conversations/project-decisions.json
  - simulate_time_passage: 3d
  - ask: What did we decide about the database migration?

objective:
  - return_decision_with_context

scoring:
  - type: contains_key_facts
    values: ["PostgreSQL", "migrate by March", "keep legacy read-only"]
    weight: 0.7
  - type: llm_rubric
    rubric: Must mention all 3 decisions with correct context and no invented details
    weight: 0.3

difficulty:
  level: medium

reset:
  mode: snapshot_restore
  snapshot: baseline-memory-fixture-v3
```

### Authoring experience (v1)
- `agentgym env init`
- schema validation
- local dry-run with 3 episodes
- publish to community registry (free/pro curated tiers)

---

## Business Model

## Free
- Local CLI
- 10 built-in environments
- Basic score reports
- Community leaderboard submission

## Pro ($29–$49/mo)
- Full environment library (50+ as roadmap)
- A/B testing with statistical reports
- CI/CD integration + gates
- Custom environment support
- Historical run tracking and trend charts

## Team ($99–$199/mo)
- Shared test suites and org workspace
- Team leaderboards and baselines
- Private environments
- API access and role controls

## Enterprise (custom)
- On-prem/self-host option
- Dedicated support and onboarding
- SLA + security/compliance controls
- Custom benchmark design

## Marketplace (phase 2)
- Community-created environments
- Paid environment packs
- Revenue share with creators

---

## Milestones & KPIs

## Week 1 (Prototype)
- CLI skeleton: run/compare/report
- 5 environments live (3 memory, 2 communication)
- 1 adapter (OpenClaw/raw API)
- **Targets:** 100 downloads, 1,000 episodes run, 20 WAU
- **On track if:** users can complete first run in <15 min

## Month 1 (MVP)
- 15 environments
- 3 adapters (OpenClaw, Codex, Claude Code)
- Basic A/B stats + HTML report
- **Targets:** 1,500 downloads, 50,000 episodes, 200 MAU
- **Revenue target:** first 25 Pro users
- **Community:** 20 leaderboard submissions
- **On track if:** >30% of active users run compare command weekly

## Month 3 (Product-market signal)
- 30 environments (memory suite mature)
- CI command + GitHub Action
- Custom env alpha
- **Targets:** 8,000 downloads, 500,000 episodes, 1,000 MAU
- **Revenue target:** $12k MRR
- **Community:** 150 custom envs, 500 leaderboard submissions
- **Adapter coverage:** 6+ frameworks
- **On track if:** churn <8% monthly for paid users

## Month 6 (Scale)
- 45+ environments
- Team features + shared suites
- Marketplace beta
- **Targets:** 25,000 downloads, 2.5M episodes, 3,000 MAU
- **Revenue target:** $60k MRR
- **Community:** 600 custom envs, 2,000 leaderboard submissions
- **On track if:** 40% of paid accounts run weekly regression suite

## Year 1 (Category owner)
- 70+ environments total
- Enterprise/on-prem offering
- Benchmarks integrated with AgentMark + Ben’s Benchmark
- **Targets:** 100,000 downloads, 15M episodes, 12,000 MAU
- **Revenue target:** $250k+ MRR blended
- **Community:** 3,000 custom envs, 10,000 leaderboard submissions
- **On track if:** AgentGym cited as default eval workflow in ecosystem docs/content

---

## Why This Wins

1. **No strong incumbent** in practical, real-task agent eval.
2. **Immediate painkiller:** users need this today for config decisions.
3. **CLI-first free tier** drives fast adoption.
4. **Paid analytics + CI + collaboration** monetize naturally.
5. **Environment network effects** create durable moat.
6. **Memory testing wedge** is acute and underserved.
7. **Strategic fit:** shared environments/scoring feed AgentMark and Ben’s Benchmark.

---

## Risks & Mitigations

## 1) Trust in scoring (especially subjective tasks)
- **Risk:** users distrust LLM judge outputs.
- **Mitigation:** prioritize deterministic graders; publish rubrics; support multi-judge consensus and calibration reports.

## 2) Reproducibility drift
- **Risk:** environment or provider changes alter results.
- **Mitigation:** frozen fixtures, seed controls, versioned environment packs, pinned model/provider options.

## 3) Adapter fragility
- **Risk:** framework APIs evolve quickly.
- **Mitigation:** strict adapter conformance tests + compatibility matrix + version pinning.

## 4) Cost/time to run large suites
- **Risk:** evaluation is expensive or slow.
- **Mitigation:** stratified sampling, early-stop rules, parallel execution, cached intermediate artifacts.

## 5) Gaming the benchmark
- **Risk:** overfitting to public tasks.
- **Mitigation:** rotating hidden holdout sets; private org suites; leaderboard anti-gaming checks.

## 6) Security/privacy concerns
- **Risk:** sensitive enterprise data cannot leave infra.
- **Mitigation:** on-prem runtime, local scoring modes, redaction hooks, strict data retention controls.

---

## Implementation Notes (v1 execution order)

1. Core CLI (`run`, `compare`, `report`) + artifact model
2. Runtime orchestration + deterministic fixture system
3. Memory suite (12 envs) + robust scoring
4. Communication/Coding/Research baseline packs
5. CI integration + regression gating
6. Team/hosted analytics + historical trends

This order maximizes immediate user value and gives AgentGym a sharp initial wedge via memory evaluation.
