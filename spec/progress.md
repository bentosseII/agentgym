# AgentGym Build Progress

## Status
- Date: 2026-02-26
- Runtime: Bun + TypeScript
- Goal: v1 CLI MVP from `spec/spec.md`

## Checklist
- [x] Read full spec (`spec/spec.md`)
- [x] CLI framework with core commands (`run`, `compare`, `benchmark`, `ci`)
- [x] Supporting commands (`tasks`, `env`, `adapter`, `replay`, `report`)
- [x] Agent adapter system with pluggable interface + built-ins
- [x] Docker-based environment runtime scaffold + deterministic seeding
- [x] Scoring system (deterministic graders + optional LLM judge)
- [x] Memory environments: 12 core memory tasks + 18-scenario memory pack
- [x] A/B paired comparison with CI, p-value, effect size, recommendation
- [x] Custom environment YAML schema + loader + validation command
- [x] npm CLI packaging (`name: agentgym`, `bin/agentgym`)
- [x] Run artifacts (JSON results, traces, markdown/html reports)
- [x] Unit tests across catalog, scoring, stats, custom env, runtime orchestration

## In-Progress Hardening
- [x] Enforce episode hard limits (`maxEpisodeMs`, `maxCostUsd`, `maxToolCalls`)
- [x] Expand test coverage for runtime limit enforcement edge cases
- [x] Final full verification gate clean (`lint`, `typecheck`, `test`)

## Notes
- Current implementation uses deterministic synthetic fixtures and seeded episode generation.
- High-isolation mode is represented by runtime flags; Docker isolation is default and disable-able via `--no-docker`.
- LLM judge is optional and automatically no-op when no API key is available.
