# Security

## Operational model

Agent Toolbox exposes a key-only OpenSSH server from an unprivileged container.
Configured workspaces may be mounted read-write, the container has unrestricted
outbound networking, and the `agent` user has passwordless `sudo` inside the
container.

Treat every mounted file, prompt, dependency, and agent tool as trusted input.
Keep the mount list as narrow as possible, use read-only mounts when practical,
and do not mount credential directories, SSH configuration, system keychains,
or the Docker socket.

The optional host Camunda integration creates a c8ctl profile in the
container's persistent home volume. It does not mount the Docker socket or give
the sandbox cluster lifecycle control. Disabling the profile removes the
convenience configuration, but it is not a firewall: the container has
unrestricted outbound networking and may still reach services that Docker
Desktop or the LAN exposes.

## Remote access

Prefer a private VPN or hardened bastion over direct Internet exposure. If a
router port forward is necessary:

- Forward TCP only to the host running the container.
- Use a dedicated Ed25519 key stored behind the phone's device protection.
- Verify the SSH host-key fingerprint on first connection.
- Keep password and root login disabled.
- Remove the forwarding rule when it is not required.
- Keep Docker, the base image, OpenSSH, and all bundled tools updated.

The default example binds SSH to `127.0.0.1`. LAN or Internet reachability must
be enabled deliberately.

## Credentials and backups

Do not commit agent login state, GitHub tokens, Moshi pairing tokens, SSH
private keys, c8ctl profiles containing credentials, or Docker volume exports.
Reauthenticate after rebuilding, or store encrypted volume backups outside the
repository.

## Reporting a vulnerability

Do not include secrets or exploit details in a public issue. Use GitHub's
private vulnerability reporting for this repository when available.
