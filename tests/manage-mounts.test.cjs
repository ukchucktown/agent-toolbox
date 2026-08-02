const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const script = path.resolve(__dirname, "..", "scripts", "manage-mounts.cjs");

function run(...args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
  });
}

function withWorkspace(callback) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "agent-toolbox-mounts-"),
  );
  try {
    const source = path.join(directory, "source");
    const config = path.join(directory, "compose.mounts.yaml");
    fs.mkdirSync(source);
    callback({ config, directory, source });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("adds, lists, and removes read-write mounts", () => {
  withWorkspace(({ config, directory, source }) => {
    const otherSource = path.join(directory, "other");
    fs.mkdirSync(otherSource);

    const add = run("add", config, source, "/workspace");
    assert.equal(add.status, 0, add.stderr);
    const addOther = run("add", config, otherSource, "/mounts/other");
    assert.equal(addOther.status, 0, addOther.stderr);

    const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
    const canonicalSource = fs.realpathSync(source);
    assert.deepEqual(parsed.services.sandbox.volumes[0], {
      type: "bind",
      source: canonicalSource,
      target: "/workspace",
      read_only: false,
      bind: {
        create_host_path: false,
      },
    });

    const list = run("list", config);
    assert.equal(list.status, 0, list.stderr);
    assert.match(list.stdout, /\/workspace \(read-write\)/);

    const remove = run("remove", config, "/mounts/other");
    assert.equal(remove.status, 0, remove.stderr);
    assert.equal(
      JSON.parse(fs.readFileSync(config, "utf8")).services.sandbox.volumes
        .length,
      1,
    );

    const removeLast = run("remove", config, "/workspace");
    assert.equal(removeLast.status, 2);
    assert.match(removeLast.stderr, /At least one/);
  });
});

test("supports read-only mounts and rejects duplicate targets", () => {
  withWorkspace(({ config, directory, source }) => {
    const otherSource = path.join(directory, "other");
    fs.mkdirSync(otherSource);

    const first = run("add", config, source, "/mounts/docs", "--read-only");
    assert.equal(first.status, 0, first.stderr);

    const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
    assert.equal(parsed.services.sandbox.volumes[0].read_only, true);

    const duplicate = run("add", config, otherSource, "/mounts/docs");
    assert.equal(duplicate.status, 2);
    assert.match(duplicate.stderr, /already uses/);
  });
});

test("supports read-only regular-file mounts", () => {
  withWorkspace(({ config, directory, source }) => {
    const shellConfig = path.join(directory, "starship.toml");
    fs.writeFileSync(shellConfig, "# private prompt configuration\n");

    const primary = run("add", config, source, "/workspace");
    assert.equal(primary.status, 0, primary.stderr);

    const addFile = run(
      "add",
      config,
      shellConfig,
      "/opt/agent-starship.toml",
      "--read-only",
    );
    assert.equal(addFile.status, 0, addFile.stderr);

    const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
    assert.deepEqual(parsed.services.sandbox.volumes[1], {
      type: "bind",
      source: fs.realpathSync(shellConfig),
      target: "/opt/agent-starship.toml",
      read_only: true,
      bind: {
        create_host_path: false,
      },
    });
  });
});

test("rejects missing sources and reserved container targets", () => {
  withWorkspace(({ config, directory, source }) => {
    const missing = run(
      "add",
      config,
      path.join(directory, "missing"),
      "/mounts/missing",
    );
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /does not exist/);

    const reserved = run("add", config, source, "/home/agent/projects");
    assert.equal(reserved.status, 2);
    assert.match(reserved.stderr, /reserved/);
  });
});

test("allows only read-only mounts at the protected global skill targets", () => {
  withWorkspace(({ config, source }) => {
    for (const target of [
      "/home/agent/.agents/skills",
      "/home/agent/.codex/skills",
      "/home/agent/.claude/skills",
    ]) {
      const writable = run("add", config, source, target);
      assert.equal(writable.status, 2);
      assert.match(writable.stderr, /must be read-only/);

      const readOnly = run("add", config, source, target, "--read-only");
      assert.equal(readOnly.status, 0, readOnly.stderr);
    }

    const nested = run(
      "add",
      config,
      source,
      "/home/agent/.codex/skills/unmanaged",
      "--read-only",
    );
    assert.equal(nested.status, 2);
    assert.match(nested.stderr, /reserved/);
  });
});
