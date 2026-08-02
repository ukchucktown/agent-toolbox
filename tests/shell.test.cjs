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
const entrypoint = fs.readFileSync(
  path.join(repository, "entrypoint.sh"),
  "utf8",
);
const launcher = fs.readFileSync(path.join(repository, "sandbox"), "utf8");
const sshd = fs.readFileSync(path.join(repository, "sshd_config"), "utf8");
const zshrc = fs.readFileSync(
  path.join(repository, "shell", "zshrc"),
  "utf8",
);
const tmux = fs.readFileSync(
  path.join(repository, "shell", "tmux.conf"),
  "utf8",
);

test("uses Zsh for SSH, local shells, and tmux", () => {
  assert.match(dockerfile, /--shell \/usr\/bin\/zsh agent/);
  assert.match(launcher, /sandbox zsh --login/);
  assert.match(sshd, /SetEnv ZDOTDIR=\/etc\/agent-shell COLORTERM=truecolor/);
  assert.match(zshrc, /export SHELL="\/usr\/bin\/zsh"/);
  assert.match(tmux, /default-shell \/usr\/bin\/zsh/);
});

test("loads an optional external shell package from a fixed path", () => {
  assert.match(dockerfile, /ZDOTDIR=\/etc\/agent-shell/);
  assert.match(zshrc, /\/opt\/agent-shell\/zshrc/);
  assert.match(tmux, /\/opt\/agent-shell\/tmux\.conf/);
});

test("uses Starship without a shell framework", () => {
  assert.match(zshrc, /starship init zsh/);
  assert.doesNotMatch(compose, /DOTFILES_PROMPT/);
  assert.doesNotMatch(zshrc, /oh-my-zsh|powerlevel10k|p10k/i);
});

test("provides the host-style listing and navigation shell baseline", () => {
  const aliases = fs.readFileSync(
    path.join(repository, "shell", "aliases.zsh"),
    "utf8",
  );

  assert.match(dockerfile, /EZA_VERSION/);
  assert.match(dockerfile, /ZOXIDE_VERSION/);
  assert.match(zshrc, /source \/etc\/agent-shell\/aliases\.zsh/);
  assert.match(zshrc, /zoxide init zsh/);
  assert.match(aliases, /alias ll='eza -lh --icons --git --no-user --no-time'/);
  assert.doesNotMatch(
    zshrc,
    /source \/opt\/agent-shell\/zshrc\s+return/,
  );
});

test("preserves protected read-only global skill mounts during startup", () => {
  assert.match(entrypoint, /\.agents\/skills/);
  assert.match(entrypoint, /\.codex\/skills/);
  assert.match(entrypoint, /\.claude\/skills/);
  assert.match(entrypoint, /-prune/);
});

test("pins the bundled standalone Zsh plugins", () => {
  for (const expected of [
    "ZSH_AUTOSUGGESTIONS_VERSION",
    "ZSH_HISTORY_SUBSTRING_SEARCH_VERSION",
    "ZSH_SYNTAX_HIGHLIGHTING_VERSION",
    "FZF_TAB_VERSION",
  ]) {
    assert.match(dockerfile, new RegExp(expected));
  }
  assert.match(dockerfile, /\/opt\/zsh-plugins/);
  assert.doesNotMatch(dockerfile, /oh-my-zsh|powerlevel10k/i);
});
