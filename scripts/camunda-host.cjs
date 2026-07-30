#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const PROFILE_NAME = "host-local";
const DEFAULT_BASE_URL = "http://host.docker.internal:8080";

function fail(message) {
  throw new Error(message);
}

function normalizeBaseUrl(input = DEFAULT_BASE_URL) {
  let url;
  try {
    url = new URL(input);
  } catch {
    fail(`Invalid Camunda host URL: ${input}`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    fail("Camunda host URL must use http or https.");
  }
  if (url.username || url.password) {
    fail("Camunda host URL must not contain credentials.");
  }
  if (url.search || url.hash) {
    fail("Camunda host URL must not contain a query string or fragment.");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    fail("Camunda host URL must not contain a path; omit /v2.");
  }

  return url.origin;
}

function orchestrationApiUrl(baseUrl) {
  return `${normalizeBaseUrl(baseUrl)}/v2`;
}

function parseProfiles(output) {
  let profiles;
  try {
    profiles = JSON.parse(output);
  } catch (error) {
    fail(`Unable to parse c8ctl profiles: ${error.message}`);
  }

  if (!Array.isArray(profiles)) {
    fail("c8ctl profile output was not an array.");
  }

  return profiles;
}

function runC8ctl(args, { capture = false } = {}) {
  const executable = process.env.C8CTL_BIN || "c8ctl";
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error || result.status === null) {
    fail(`c8ctl did not run: ${result.error?.message || "unknown launch error"}`);
  }
  if (result.status !== 0) {
    const details = capture ? result.stderr.trim() : "";
    fail(
      `c8ctl ${args.join(" ")} failed with status ${result.status}${
        details ? `: ${details}` : ""
      }`,
    );
  }

  return result.stdout || "";
}

function listProfiles() {
  return parseProfiles(runC8ctl(["list", "profiles", "--json"], { capture: true }));
}

function findHostProfile() {
  return listProfiles().find((profile) => profile.Name === PROFILE_NAME);
}

async function checkTopology(apiUrl) {
  let response;
  try {
    response = await fetch(`${apiUrl}/topology`, {
      headers: {
        accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    fail(`Host cluster is unreachable at ${apiUrl}: ${error.message}`);
  }

  if (!response.ok) {
    fail(`Host cluster returned HTTP ${response.status} from ${apiUrl}/topology.`);
  }
}

async function enableHost(baseUrlInput) {
  const baseUrl = normalizeBaseUrl(baseUrlInput);
  const apiUrl = orchestrationApiUrl(baseUrl);

  await checkTopology(apiUrl);

  const existing = findHostProfile();
  if (existing) {
    runC8ctl(["remove", "profile", PROFILE_NAME, "--yes"]);
  }

  runC8ctl(["add", "profile", PROFILE_NAME, `--baseUrl=${apiUrl}`]);
  runC8ctl(["get", "topology", `--profile=${PROFILE_NAME}`, "--json"], {
    capture: true,
  });

  console.log(`Enabled c8ctl profile '${PROFILE_NAME}' for ${apiUrl}.`);
  console.log(`Use --profile=${PROFILE_NAME} on every cluster command.`);
  console.log("The host remains responsible for c8run start, stop, and logs.");
}

async function showStatus() {
  const profile = findHostProfile();
  if (!profile) {
    console.log(`Camunda host access is disabled; profile '${PROFILE_NAME}' is absent.`);
    return;
  }

  await checkTopology(profile.URL);
  runC8ctl(["get", "topology", `--profile=${PROFILE_NAME}`, "--json"], {
    capture: true,
  });

  console.log(`Camunda host access is enabled through '${PROFILE_NAME}'.`);
  console.log(`Orchestration API: ${profile.URL}`);
}

function disableHost() {
  const profile = findHostProfile();
  if (!profile) {
    console.log(`Camunda host access is already disabled.`);
    return;
  }

  runC8ctl(["remove", "profile", PROFILE_NAME, "--yes"]);
  console.log(`Removed c8ctl profile '${PROFILE_NAME}'.`);
}

function usage() {
  console.error(`Usage:
  camunda-host enable-host [BASE_URL]
  camunda-host status
  camunda-host disable-host`);
}

async function main() {
  const [, , action, ...args] = process.argv;

  switch (action) {
    case "enable-host":
      if (args.length > 1) {
        usage();
        process.exitCode = 2;
        return;
      }
      await enableHost(args[0] || DEFAULT_BASE_URL);
      break;
    case "status":
      if (args.length > 0) {
        usage();
        process.exitCode = 2;
        return;
      }
      await showStatus();
      break;
    case "disable-host":
      if (args.length > 0) {
        usage();
        process.exitCode = 2;
        return;
      }
      disableHost();
      break;
    default:
      usage();
      process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Camunda host configuration error: ${error.message}`);
    process.exitCode = 2;
  });
}

module.exports = {
  DEFAULT_BASE_URL,
  PROFILE_NAME,
  normalizeBaseUrl,
  orchestrationApiUrl,
  parseProfiles,
};
