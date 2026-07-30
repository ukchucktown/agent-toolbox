#!/usr/bin/env bash

export PATH="/opt/agent-tools/node_modules/.bin:/usr/local/bin:${PATH}"
export LANG="${LANG:-C.UTF-8}"
export LC_ALL="${LC_ALL:-C.UTF-8}"

if [[ $- == *i* ]]; then
  printf '%s\n' \
    "Agent Sandbox" \
    "  Projects: /workspace" \
    "  Start:    cd /workspace/<project> && herdr" \
    "  Agents:   codex | claude"
fi
