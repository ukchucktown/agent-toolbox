const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "..");
const dockerfile = fs.readFileSync(
  path.join(repository, "Dockerfile"),
  "utf8",
);
const compose = fs.readFileSync(
  path.join(repository, "compose.yaml"),
  "utf8",
);

test("builds the development toolchain into the sandbox image", () => {
  for (const expected of [
    "PYTHON_VERSION",
    "UV_VERSION",
    "JAVA_VERSION",
    "MAVEN_VERSION",
    "GH_VERSION",
    "NEOVIM_VERSION",
    "NEOVIM_SHA256_AMD64",
    "NEOVIM_SHA256_ARM64",
    "TMUX_VERSION",
    "TMUX_SHA256",
    "STARSHIP_VERSION",
    "STARSHIP_SHA256_AMD64",
    "STARSHIP_SHA256_ARM64",
    "TREE_SITTER_CLI_VERSION",
    "C8CTL_VERSION",
    "@camunda8/cli@${C8CTL_VERSION}",
    "cargo install",
    "--no-default-features",
    "tree-sitter-cli",
    "mosh",
    "corepack enable pnpm",
    "nvim-linux-${neovim_arch}.tar.gz",
    "tmux-${TMUX_VERSION}.tar.gz",
    "starship-${starship_arch}-unknown-linux-musl.tar.gz",
    "sha256sum --check --strict",
    "fzf",
    "tree",
    "bat",
  ]) {
    assert.match(dockerfile, new RegExp(escapeRegex(expected)));
  }
});

test("publishes a configurable Mosh UDP range", () => {
  assert.match(dockerfile, /EXPOSE 22\/tcp 60000-60010\/udp/);
  assert.match(compose, /MOSH_UDP_PORT_RANGE:-60000-60010/);
  assert.match(compose, /\/udp/);
});

test("does not grant the sandbox Docker daemon access", () => {
  assert.doesNotMatch(dockerfile, /docker\.sock|docker-cli|docker-ce-cli/);
  assert.doesNotMatch(compose, /docker\.sock/);
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
