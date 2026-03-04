# AgentGym

CLI framework to test, validate, benchmark, and compare AI agents on realistic task environments.

## Stack
- Runtime: Bun
- Language: TypeScript (strict)
- CLI: Commander
- Validation: Zod + YAML

## Repo Layout
- `src/cli.ts`: CLI entrypoint
- `src/commands/*`: CLI commands (`run`, `compare`, `benchmark`, `ci`, etc.)
- `src/core/*`: adapters, runtime, environments, scoring, stats, artifacts
- `src/templates/*`: starter templates for custom adapters/environments
- `tests/unit/*`: unit/integration-leaning tests
- `spec/spec.md`: product spec
- `spec/progress.md`: implementation progress tracker

## Core Commands
- `agentgym run --task <id> --episodes <n> --agent <config.yaml>`
- `agentgym compare --task <id> --config-a <a.yaml> --config-b <b.yaml>`
- `agentgym benchmark --suite standard|memory|full`
- `agentgym ci --suite <suite.yaml>`
- `agentgym tasks list|inspect`
- `agentgym env init|validate`
- `agentgym adapter init|list`

## Dev Workflow
- Install deps: `bun install`
- Lint fix: `bun run lint:fix`
- Typecheck: `bun run typecheck`
- Test: `bun test`
- Coverage: `bun test --coverage`
- Full gate: `bun run verify`

## Product Constraints
- Keep environment catalog aligned with spec:
  - 40 core tasks across 7 categories
  - 18 memory scenario pack tasks
- Keep adapter system framework-agnostic via `AgentAdapter` contract
- Preserve deterministic seeded episode behavior and reproducible artifacts
