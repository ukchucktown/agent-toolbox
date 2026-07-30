#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const input = fs.readFileSync(0, "utf8").trim();
const fields = input.split(/\s+/);
const allowedTypes = new Set([
  "ssh-ed25519",
  "sk-ssh-ed25519@openssh.com",
]);

if (fields.length < 2 || !allowedTypes.has(fields[0])) {
  console.error(
    "Expected one Ed25519 public key beginning with ssh-ed25519 or sk-ssh-ed25519@openssh.com.",
  );
  process.exit(2);
}

if (!/^[A-Za-z0-9+/]+={0,2}$/.test(fields[1])) {
  console.error("The SSH public-key payload is malformed.");
  process.exit(2);
}

const normalized = fields.join(" ");
const sshDir = path.join(os.homedir(), ".ssh");
const keysPath = path.join(sshDir, "authorized_keys");

fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });

const existing = fs.existsSync(keysPath)
  ? fs
      .readFileSync(keysPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  : [];

const keyIdentity = `${fields[0]} ${fields[1]}`;
const alreadyPresent = existing.some((line) =>
  line.startsWith(`${keyIdentity} `) || line === keyIdentity,
);

if (!alreadyPresent) {
  existing.push(normalized);
  fs.writeFileSync(keysPath, `${existing.join("\n")}\n`, { mode: 0o600 });
}

fs.chmodSync(sshDir, 0o700);
fs.chmodSync(keysPath, 0o600);

console.log(alreadyPresent ? "SSH key already authorized." : "SSH key authorized.");
