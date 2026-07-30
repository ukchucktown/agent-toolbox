const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_BASE_URL,
  PROFILE_NAME,
  normalizeBaseUrl,
  orchestrationApiUrl,
  parseProfiles,
} = require("../scripts/camunda-host.cjs");

test("normalizes the default host URL and derives the orchestration API", () => {
  assert.equal(normalizeBaseUrl(), DEFAULT_BASE_URL);
  assert.equal(
    normalizeBaseUrl("http://host.docker.internal:8080/"),
    DEFAULT_BASE_URL,
  );
  assert.equal(
    orchestrationApiUrl(DEFAULT_BASE_URL),
    "http://host.docker.internal:8080/v2",
  );
});

test("rejects unsafe or ambiguous host URLs", () => {
  assert.throws(
    () => normalizeBaseUrl("ftp://host.docker.internal:8080"),
    /http or https/,
  );
  assert.throws(
    () => normalizeBaseUrl("http://user:secret@host.docker.internal:8080"),
    /must not contain credentials/,
  );
  assert.throws(
    () => normalizeBaseUrl("http://host.docker.internal:8080/v2"),
    /omit \/v2/,
  );
});

test("parses c8ctl JSON profile output", () => {
  const profiles = parseProfiles(
    JSON.stringify([
      {
        Name: PROFILE_NAME,
        URL: "http://host.docker.internal:8080/v2",
        Tenant: "<default>",
        Source: "c8ctl",
      },
    ]),
  );

  assert.equal(profiles[0].Name, PROFILE_NAME);
  assert.equal(profiles[0].Source, "c8ctl");
  assert.throws(() => parseProfiles("{}"), /was not an array/);
});
