#!/usr/bin/env bash

set -euo pipefail

agent_home=/home/agent
host_key_dir=/etc/ssh/host_keys

install -d -m 0755 /run/sshd
install -d -m 0700 -o agent -g agent "${agent_home}/.ssh"
touch "${agent_home}/.ssh/authorized_keys"
chmod 0600 "${agent_home}/.ssh/authorized_keys"

if [[ ! -e "${agent_home}/.profile" ]]; then
  cp -a /etc/skel/. "${agent_home}/"
fi

chown -R agent:agent "${agent_home}"

if [[ ! -s "${host_key_dir}/ssh_host_ed25519_key" ]]; then
  ssh-keygen -q -t ed25519 -N '' -f "${host_key_dir}/ssh_host_ed25519_key"
fi

chmod 0600 "${host_key_dir}/ssh_host_ed25519_key"
chmod 0644 "${host_key_dir}/ssh_host_ed25519_key.pub"

# Initialize each agent's configuration directory before Moshi looks for it.
# Both status commands are expected to return non-zero until authentication.
gosu agent env HOME="${agent_home}" PATH="${PATH}" codex login status >/dev/null 2>&1 || true
gosu agent env HOME="${agent_home}" PATH="${PATH}" claude auth status >/dev/null 2>&1 || true

if ! gosu agent env HOME="${agent_home}" PATH="${PATH}" \
  moshi-hook install --target codex --target claude; then
  echo "warning: Moshi agent hooks were not installed; run ./sandbox moshi-install" >&2
fi

gosu agent env HOME="${agent_home}" PATH="${PATH}" bash -c '
  while true; do
    moshi-hook serve
    exit_code=$?
    echo "moshi-hook exited with status ${exit_code}; retrying in 5 seconds" >&2
    sleep 5
  done
' >>"${agent_home}/moshi-hook.log" 2>&1 &

exec /usr/sbin/sshd -D -e -f /etc/ssh/sshd_config
