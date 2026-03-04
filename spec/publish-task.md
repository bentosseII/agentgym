# Task: Package AgentGym for npm publish

## Context
AgentGym at ~/workspace/agent-gym is a working CLI. All tests pass. Now make it publishable.

## What to do

### 1. Package.json cleanup
- Name: `agentgym` (check if available, if not use `@bensbites/agentgym`)
- Version: 0.1.0
- Description, keywords, license (MIT), repository, author (Ben Tossell)
- bin: `{ "agentgym": "./bin/agentgym.js" }` 
- files: include src, bin, README
- engines: node >=18

### 2. Build pipeline
- Add a build step that compiles TS to JS (use bun build or tsup — whatever's simplest)
- Ensure `bin/agentgym.js` is a proper entry point with shebang
- Test that `npx .` works locally

### 3. README.md
- Clear, punchy README. Not a wall of text.
- "OpenAI Gym for real-world agent tasks"
- Quick start: install, run first benchmark, see results
- Show example output (the scorecard format)
- List task categories and counts
- Adapter section (mock, openclaw, anthropic, openai, custom)
- Link to full docs (can be placeholder)

### 4. CLI polish
- `agentgym --version` should work
- `agentgym` with no args should show help
- Make sure all commands have useful --help text

### 5. .npmignore / files field
- Exclude: tests, runs, spec, configs, .github, coverage
- Include: dist/build output, bin, README, LICENSE, package.json

### 6. Create LICENSE file (MIT)

### 7. Test the full flow
- `bun run build` works
- `bun run verify` still passes
- Simulated `npm pack` produces clean tarball
- `npx ./agentgym-0.1.0.tgz run --task memory-pref-1d --episodes 1 --adapter mock --no-docker` works

### 8. GitHub repo setup
- Init git if not already
- Create .gitignore (node_modules, runs, dist, coverage, .hivevm)
- Make initial commit
- Do NOT push (Ben will create the repo)

When completely finished, run: openclaw system event --text "Done: AgentGym packaged for npm publish — ready for npm publish and GitHub push" --mode now
