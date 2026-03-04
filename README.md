# AgentGym

**OpenAI Gym for real-world agent tasks.**

CLI to test, benchmark, compare, and gate AI agents against deterministic task environments.

## Install

```bash
npm install -g agentgym
# or
npx agentgym --help
```

## Quick Start

Run your first benchmark:

```bash
agentgym benchmark --suite standard --episodes 1 --adapter mock --no-docker
```

See results:

```bash
# run artifacts
ls runs/<run-id>/

# render markdown report
agentgym report <run-id> --format md
```

## Example Scorecard Output

```text
suite: standard
run_id: benchmark-standard-20260227-0830
quality: 8.214/10
success: 87.50%
reliability: 92.18%
percentile_estimate: 96.1
profile: runs/benchmark-standard-20260227-0830/benchmark-profile.json
```

## Task Catalog

Core catalog: **40 tasks across 7 categories**.

- memory: 12
- communication: 7
- coding: 6
- research: 5
- admin: 4
- multi-step: 3
- tool-use: 3

Memory scenario pack: **18 additional memory stress tasks**.

## Adapters

Built-in + custom adapter workflow.

- `mock` (default, deterministic local testing)
- `openclaw`
- `anthropic`
- `openai`
- `custom` (via `--custom-adapter <path>`)

List current built-ins:

```bash
agentgym adapter list
```

## Common Commands

```bash
agentgym run --task memory-pref-1d --episodes 20 --adapter mock --no-docker
agentgym compare --task memory-pref-7d --config-a a.yaml --config-b b.yaml
agentgym ci --suite ./ci-suite.yaml
agentgym tasks list
```

## Docs

- Full docs: https://github.com/bentossell/agent-gym/tree/main/spec

## License

MIT
