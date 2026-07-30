const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "..");
const dockerfile = fs.readFileSync(
  path.join(repository, "Dockerfile"),
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

test("pins the bundled Zsh framework and plugins", () => {
  for (const expected of [
    "OH_MY_ZSH_VERSION",
    "POWERLEVEL10K_VERSION",
    "ZSH_AUTOSUGGESTIONS_VERSION",
    "ZSH_SYNTAX_HIGHLIGHTING_VERSION",
    "FZF_TAB_VERSION",
  ]) {
    assert.match(dockerfile, new RegExp(expected));
  }
});
