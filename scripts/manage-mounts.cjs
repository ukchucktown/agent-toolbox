#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const [, , command, configPath, ...args] = process.argv;

function usage() {
  console.error(`Usage:
  manage-mounts.cjs list CONFIG
  manage-mounts.cjs add CONFIG SOURCE TARGET [--read-only]
  manage-mounts.cjs remove CONFIG TARGET
  manage-mounts.cjs validate CONFIG`);
}

function emptyConfig() {
  return {
    services: {
      sandbox: {
        volumes: [],
      },
    },
  };
}

function fail(message) {
  throw new Error(message);
}

function normalizeTarget(target) {
  if (typeof target !== "string" || !path.posix.isAbsolute(target)) {
    fail(`Container target must be an absolute POSIX path: ${target}`);
  }

  const normalized = path.posix.normalize(target);
  const reservedTargets = ["/home/agent", "/etc/ssh/host_keys"];

  if (normalized === "/") {
    fail("Refusing to mount over the container root.");
  }

  if (
    reservedTargets.some(
      (reserved) =>
        normalized === reserved || normalized.startsWith(`${reserved}/`),
    )
  ) {
    fail(`Container target is reserved for persistent sandbox state: ${normalized}`);
  }

  return normalized;
}

function normalizeSource(source, requireExisting) {
  if (typeof source !== "string" || !path.isAbsolute(source)) {
    fail(`Host source must be an absolute path: ${source}`);
  }

  if (!requireExisting) {
    return path.normalize(source);
  }

  let stat;
  try {
    stat = fs.statSync(source);
  } catch {
    fail(`Host source does not exist: ${source}`);
  }

  if (!stat.isDirectory()) {
    fail(`Host source must be a directory: ${source}`);
  }

  return fs.realpathSync(source);
}

function validateConfig(config, allowEmpty = false) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    fail("Mount configuration must be a JSON object.");
  }

  const volumes = config.services?.sandbox?.volumes;
  if (!Array.isArray(volumes)) {
    fail("Expected services.sandbox.volumes to be an array.");
  }
  if (!allowEmpty && volumes.length === 0) {
    fail("At least one bind mount must be configured.");
  }

  const targets = new Set();
  for (const [index, mount] of volumes.entries()) {
    if (!mount || typeof mount !== "object" || Array.isArray(mount)) {
      fail(`Mount ${index + 1} must be an object.`);
    }
    if (mount.type !== "bind") {
      fail(`Mount ${index + 1} must have type "bind".`);
    }

    normalizeSource(mount.source, false);
    const target = normalizeTarget(mount.target);
    if (targets.has(target)) {
      fail(`Duplicate container target: ${target}`);
    }
    targets.add(target);

    if (
      mount.read_only !== undefined &&
      typeof mount.read_only !== "boolean"
    ) {
      fail(`Mount ${index + 1} read_only must be true or false.`);
    }
    if (mount.bind?.create_host_path !== false) {
      fail(`Mount ${index + 1} must set bind.create_host_path to false.`);
    }
  }

  return volumes;
}

function readConfig(filePath, allowMissing, allowEmpty = false) {
  if (!fs.existsSync(filePath)) {
    if (allowMissing) {
      return emptyConfig();
    }
    fail(`Mount configuration does not exist: ${filePath}`);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Invalid JSON in ${filePath}: ${error.message}`);
  }

  validateConfig(config, allowEmpty);
  return config;
}

function writeConfig(filePath, config) {
  validateConfig(config);
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.tmp`,
  );

  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
      mode: 0o600,
    });
    fs.renameSync(temporaryPath, filePath);
    fs.chmodSync(filePath, 0o600);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.unlinkSync(temporaryPath);
    }
  }
}

function listMounts(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`No mount configuration at ${filePath}`);
    return;
  }

  const volumes = validateConfig(readConfig(filePath, false));
  console.log(`Mount configuration: ${filePath}`);
  if (volumes.length === 0) {
    console.log("No bind mounts configured.");
    return;
  }

  for (const mount of volumes) {
    const mode = mount.read_only ? "read-only" : "read-write";
    console.log(`${mount.source} -> ${mount.target} (${mode})`);
  }
}

function addMount(filePath, commandArgs) {
  const [source, target, ...options] = commandArgs;
  if (!source || !target) {
    usage();
    process.exit(2);
  }

  const unknownOptions = options.filter((option) => option !== "--read-only");
  if (unknownOptions.length > 0) {
    fail(`Unknown option: ${unknownOptions[0]}`);
  }

  const config = readConfig(filePath, true, true);
  const volumes = validateConfig(config, true);
  const normalizedSource = normalizeSource(source, true);
  const normalizedTarget = normalizeTarget(target);

  if (volumes.some((mount) => mount.target === normalizedTarget)) {
    fail(
      `A mount already uses ${normalizedTarget}; remove it before adding a replacement.`,
    );
  }

  volumes.push({
    type: "bind",
    source: normalizedSource,
    target: normalizedTarget,
    read_only: options.includes("--read-only"),
    bind: {
      create_host_path: false,
    },
  });

  writeConfig(filePath, config);
  console.log(`Added ${normalizedSource} -> ${normalizedTarget}.`);
  console.log("Run ./sandbox config to review, then ./sandbox up to apply.");
}

function removeMount(filePath, commandArgs) {
  const [target, ...extraArgs] = commandArgs;
  if (!target || extraArgs.length > 0) {
    usage();
    process.exit(2);
  }

  const config = readConfig(filePath, false);
  const volumes = validateConfig(config);
  const normalizedTarget = normalizeTarget(target);
  const index = volumes.findIndex((mount) => mount.target === normalizedTarget);

  if (index === -1) {
    fail(`No mount uses container target ${normalizedTarget}.`);
  }
  if (volumes.length === 1) {
    fail("At least one bind mount must remain configured.");
  }

  const [removed] = volumes.splice(index, 1);
  writeConfig(filePath, config);
  console.log(`Removed ${removed.source} -> ${normalizedTarget}.`);
  console.log("Run ./sandbox config to review, then ./sandbox up to apply.");
}

try {
  if (!command || !configPath) {
    usage();
    process.exit(2);
  }

  switch (command) {
    case "list":
      if (args.length > 0) {
        usage();
        process.exit(2);
      }
      listMounts(configPath);
      break;
    case "add":
      addMount(configPath, args);
      break;
    case "remove":
      removeMount(configPath, args);
      break;
    case "validate":
      if (args.length > 0) {
        usage();
        process.exit(2);
      }
      readConfig(configPath, false);
      break;
    default:
      usage();
      process.exit(2);
  }
} catch (error) {
  console.error(`Mount configuration error: ${error.message}`);
  process.exit(2);
}
