# Agent Toolbox

A container-scoped remote development host for
[Moshi](https://getmoshi.app/), [Herdr](https://herdr.dev/), Codex CLI, and
Claude Code. The container exposes a key-only SSH endpoint and mounts a chosen
host directory at `/workspace`.

The Docker runtime retains the `agent-sandbox` name so existing installations
can upgrade without creating new containers or volumes.

## Security boundary

The container can read, modify, and delete everything below the configured
`GITHUB_ROOT`. Mount only directories whose entire contents may be accessed by
the agents.

The container does not mount the rest of the host home directory, host SSH
configuration, system credential stores, or the Docker socket, and it is not
privileged. However:

- The `agent` user has passwordless `sudo` inside the container.
- Outbound network access, including access to services on the local network,
  is not restricted.
- SSH local forwarding is enabled for Moshi integrations.
- Agent credentials and histories persist in the `agent-home` Docker volume.
- SSH host keys persist separately in the `ssh-host-keys` Docker volume.

This setup limits host filesystem exposure; it is not a boundary for running
untrusted prompts, dependencies, or code. See [SECURITY.md](SECURITY.md) before
making the SSH endpoint reachable outside the host.

## Requirements

- Docker Desktop or Docker Engine with Compose
- Bash
- A host directory to mount as `/workspace`
- Moshi on a mobile device, if remote terminal access is desired

## Configure

The launcher reads configuration in this order:

1. The file named by `AGENT_TOOLBOX_ENV_FILE`
2. `~/.config/agent-toolbox/agent-sandbox.env`
3. The ignored `.env` file in this repository

For a simple local setup:

```bash
cp .env.example .env
```

For a Stow-managed setup, store the file in the dotfiles tree at:

```text
.config/agent-toolbox/agent-sandbox.env
```

At minimum, set `GITHUB_ROOT` to the directory agents may access. The example
binds SSH to `127.0.0.1` for a safe local-only default. To connect from another
device on the LAN, deliberately change `SSH_BIND_ADDRESS` to `0.0.0.0` after
configuring key authentication.

## Build and start

```bash
./sandbox build
./sandbox up
./sandbox status
```

The SSH endpoint uses:

```text
Host: <host-lan-ip>
Port: <configured SSH_PORT, default 49222>
User: agent
Transport: SSH
```

The container accepts public-key authentication only. No login password is set.

## Authorize Moshi

Because Docker publishes a nonstandard SSH port, use Moshi's manual connection
flow instead of Easy Pair:

1. In Moshi, create or generate a dedicated Ed25519 key.
2. Copy the public key, not the private key.
3. Authorize it on the host. On macOS, the clipboard can be piped directly:

   ```bash
   pbpaste | ./sandbox authorize-key
   ./sandbox keys
   ./sandbox host-key
   ```

   On another platform, pass or pipe the public key to
   `./sandbox authorize-key`.

4. Add a Moshi connection using the host's LAN address and configured port.
5. Compare Moshi's first-connect SSH fingerprint with `./sandbox host-key`.

Use SSH transport in Moshi. Herdr keeps processes alive when the SSH connection
drops, so a Mosh UDP port range does not need to be exposed.

## Authenticate the agents

Authentication state remains inside the persistent `agent-home` volume.

For Codex:

```bash
./sandbox codex-login
```

Open the displayed URL on a trusted device and enter the one-time code.

For Claude Code:

```bash
./sandbox claude-login
```

Follow the browser login flow. If a browser cannot open in the container, open
the displayed URL on a trusted device and paste the returned code into the
terminal.

Check all installed tools:

```bash
./sandbox versions
```

## Pair Moshi agent hooks

In Moshi, open **Settings → Agent Hooks** and copy the pairing token. Then run:

```bash
./sandbox moshi-pair
```

The command prompts without echoing the token, stores the credential inside the
persistent home volume, installs hooks for Codex and Claude Code, and restarts
the container daemon.

Diagnostics:

```bash
./sandbox status
./sandbox logs
```

## Run agents with Herdr

Connect using Moshi, then:

```bash
cd /workspace/<project>
herdr
```

Start `codex` or `claude` in Herdr tabs. Every project below `GITHUB_ROOT` is
available below `/workspace`.

## Reach it away from home

A private VPN or a hardened bastion is preferred. If direct router forwarding
is the only available option, reserve the host's LAN address and forward only
the configured TCP port:

```text
External/global port: <SSH_PORT>
Destination device:   <host-lan-ip>
Base/internal port:   <SSH_PORT>
Protocol:             TCP
```

Use the public IPv4 address or a DDNS hostname in Moshi. Keep the configured
port, user `agent`, key authentication, and SSH transport, then test over a
cellular connection.

A high port reduces scanner noise but is not a security boundary. Use a
dedicated Moshi key, verify the SSH host fingerprint, protect the phone with a
strong device passcode, and remove the forwarding rule when remote access is
not needed.

## Daily commands

```text
./sandbox up             Start
./sandbox down           Stop without deleting credentials
./sandbox shell          Open a local container shell
./sandbox restart        Restart
./sandbox status         Show container and tool status
./sandbox logs           Follow logs
./sandbox moshi-install  Refresh hooks after an agent upgrade
```

## Upgrade tools

Tool versions are pinned in the selected environment file. Update the desired
version and then rebuild:

```bash
./sandbox build
./sandbox up
./sandbox moshi-install
```

Do not run `docker compose down --volumes` unless you intend to delete the
persisted Codex login, Claude login, Herdr state, Moshi pairing, and SSH host
identity.

## License

[MIT](LICENSE)
