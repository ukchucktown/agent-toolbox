#!/usr/bin/env bash

export JAVA_HOME="/opt/java/openjdk"
export MAVEN_HOME="/usr/share/maven"
export PATH="${JAVA_HOME}/bin:${MAVEN_HOME}/bin:/opt/agent-tools/node_modules/.bin:/usr/local/bin:${PATH}"
export LANG="${LANG:-C.UTF-8}"
export LC_ALL="${LC_ALL:-C.UTF-8}"

if [[ $- == *i* ]]; then
  printf '%s\n' \
    "Agent Toolbox" \
    "  Projects: /workspace" \
    "  Start:    cd /workspace/<project> && herdr" \
    "  Agents:   codex | claude" \
    "  Camunda:  ./sandbox camunda enable-host (run on the host)"
fi
