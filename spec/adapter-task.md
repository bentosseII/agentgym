# Task: Build an OpenClaw Gateway adapter for AgentGym

## Context
AgentGym is at ~/workspace/agent-gym. It's a Bun+TypeScript CLI for testing AI agents.
The mock adapter works. Now we need a REAL adapter that tests agents through the OpenClaw gateway.

## The key insight
We don't want to call raw LLM APIs. We want to test the FULL agent — memory, tools, personality, system prompt — by talking to it through the OpenClaw gateway CLI.

## What to build

### 1. OpenClawAdapter (`src/core/adapters/openclawAdapter.ts`)
- Implements `AgentAdapter` from `src/core/types.ts`
- Uses `openclaw agent` CLI to send messages and get responses:
  ```bash
  openclaw agent --message "your prompt here" --json --timeout 120
  ```
- Parse the JSON response to extract the agent's reply text
- On `act(observation)`:
  - Send `observation.prompt` as the message (include context/constraints naturally in the prompt text)
  - Parse JSON output for the agent's response
  - Return `AgentAction` with response as `output`
  - Extract any metadata (tokens, cost) from JSON if available
- Support config options:
  - `config.metadata.agentId` → `--agent <id>` flag
  - `config.metadata.sessionId` → `--session-id <id>` flag  
  - `config.metadata.thinking` → `--thinking <level>` flag
  - `config.timeoutMs` → `--timeout` flag (convert ms to seconds)
- Each episode should ideally use a fresh session (no cross-contamination between episodes)
  - Generate a unique session ID per episode in `startEpisode()` using the run ID + episode number
  - Pass it via `--session-id`

### 2. Also build a simple AnthropicAdapter (`src/core/adapters/anthropicAdapter.ts`)
- For comparison: test raw Claude vs Claude-through-OpenClaw
- Uses native fetch to call Anthropic Messages API directly
- Reads `ANTHROPIC_API_KEY` from env
- Model configurable via `config.model` (default: `claude-sonnet-4-20250514`)
- Track token usage and estimate cost in metadata

### 3. Register both in `src/core/adapters/registry.ts`
- `openclaw` → OpenClawAdapter (replace the existing shell adapter mapping)
- `anthropic` → AnthropicAdapter
- Keep mock, shell, and other existing adapters

### 4. LLM Judge enhancement (`src/core/scoring/llmJudge.ts`)
- Check if this file exists and whether it actually calls an LLM
- If stubbed, implement it using Anthropic API (native fetch):
  - Takes: agent output, expected facts, rubric text
  - Returns: quality score (1-10), reasoning, failure modes detected
  - Uses `ANTHROPIC_API_KEY` env var
  - Use claude-sonnet for judging (cheap + fast)

### 5. Update tests
- Add unit tests for OpenClawAdapter (mock the child_process spawn)
- Add unit tests for AnthropicAdapter (mock fetch)
- Test LLM judge scoring logic

### 6. Verify
- Run `bun run verify` (lint + typecheck + test) — must pass
- Don't break any existing tests

## Constraints
- No new npm dependencies (use native fetch + child_process)
- Keep it simple
- Follow existing code patterns in the repo
- TypeScript strict mode

When completely finished, run: openclaw system event --text "Done: Built OpenClaw gateway adapter + Anthropic adapter + LLM judge for AgentGym" --mode now
