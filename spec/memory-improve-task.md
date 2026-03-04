# Task: Improve Clawd's memory retrieval for AgentGym benchmarks

## Context
Clawd's memory system uses BM25 search via qmd (a local memory search tool). 
Current AgentGym scores show:
- Simple preference recall: 100% ✅
- Negative recall (saying "I don't know"): 100% ✅  
- Similar entity disambiguation: 33% ❌
- Conflict/update handling: 0% ❌
- Decision context recall: 0% ❌
- Vague query recall: 0% ❌

The memory files live in ~/memory/ (markdown files, daily logs + INDEX.md).
The search tool is `qmd query "search terms" -n 5` (BM25, sub-1s).
OpenClaw also has a `memory_search` tool that agents can use.

## Problem
BM25 is literal keyword matching. It fails on:
1. Fuzzy/vague queries ("that thing from last week")
2. Temporal reasoning ("what's the LATEST preference" when old + new exist)
3. Multi-fact synthesis (combining info from multiple entries)

## What to build

### 1. Query expansion helper script (`~/tools/memory-query-expand`)
A small CLI that takes a vague query and outputs 3-5 expanded search queries.
- Input: "that thing from last week" 
- Output: multiple specific queries to try
- Use simple heuristics first (add date ranges, synonyms, related terms)
- Can be called by the agent before memory_search

### 2. Memory metadata enrichment script (`~/tools/memory-enrich`)
Scan existing memory files and add/improve metadata:
- Ensure all entries have dates
- Add tags/categories where missing
- Create a temporal index file (`~/memory/clawd/TIMELINE.md`) that lists key facts with dates
- This gives the agent a browseable timeline for temporal queries

### 3. Conflict resolution index (`~/memory/clawd/LATEST.md`)
- Scan memory files for preference/decision entries
- Create a "latest state" file that tracks current values
- Format: `| Topic | Current Value | Last Updated | Source |`
- Agent can check this file for conflict resolution

### 4. Test the improvements
Run AgentGym against the same 6 tasks after making changes:
```bash
cd ~/workspace/agent-gym && bun -e "
import { executeRun } from './src/core/runtime/orchestrator.ts';
import { parseAdapterConfig } from './src/core/adapters/config.ts';
const agentConfig = await parseAdapterConfig('./configs/openclaw.yaml');
const tasks = ['memory-pref-1d','memory-decision-context','memory-similar-items','memory-conflict-update','memory-negative-recall','memory-vague-query'];
const result = await executeRun({ runLabel:'memory-v2', taskIds:tasks, episodes:3, seed:42, parallelism:1, agentConfig, runtime:{parallelism:1,useDocker:false,highIsolation:false,maxEpisodeMs:120000}, limits:{maxEpisodeMs:120000,maxCostUsd:2,maxToolCalls:30}, enableLLMJudge:false });
console.log('=== MEMORY V2 SCORECARD ===');
console.log('Overall quality:', result.summary.overall.qualityMean.toFixed(1)+'/10');
console.log('Overall success:', (result.summary.overall.successRate*100).toFixed(0)+'%');
for (const t of result.summary.tasks) console.log(t.taskId.padEnd(30), 'success:', (t.successRate*100).toFixed(0)+'%', 'quality:', t.qualityMean.toFixed(1));
"
```

When completely finished, run: openclaw system event --text "Done: Memory retrieval improvements built + re-tested against AgentGym" --mode now
