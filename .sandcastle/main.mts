import { run, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { execFileSync } from "node:child_process";

// Bedrock session credentials, minted on the host before the run starts.
//
// The profile is `_sso_default`, not `default`. The host's `default` profile
// resolves through `credential_process = aws configure export-credentials
// --profile _sso_default`, and `_sso_default` is the one that actually declares
// `sso_session = bmw-sso`.
//
// Minting here rather than mounting `~/.aws` into the sandbox, because the SDK
// inside the container cannot make an SSO session work on its own: it has no
// `aws` binary to run the credential_process with, and it does not renew an
// expired access token from the refresh token beside it. Both failures land
// mid-ticket, inside a container, as an API error. Resolving on the host puts
// them here instead, before an agent has started, where `aws sso login` is a
// thing the author can actually do.
const AWS_PROFILE = "_sso_default";

// A run that outlives its credentials dies part-way through a ticket, and these
// are not renewed once the sandbox is up. Refuse to start a run that cannot
// plausibly finish rather than discovering the expiry in an iteration's logs.
const REQUIRED_CREDENTIAL_LIFE_MS = 45 * 60 * 1000;

const exported = (() => {
  let raw: string;
  try {
    raw = execFileSync(
      "aws",
      ["configure", "export-credentials", "--profile", AWS_PROFILE, "--format", "process"],
      { encoding: "utf8" },
    );
  } catch (cause) {
    throw new Error(
      `Could not mint AWS credentials from profile ${AWS_PROFILE} on the host. ` +
        `The SSO session has most likely expired: run ` +
        `\`aws sso login --profile ${AWS_PROFILE}\` and start the run again.`,
      { cause },
    );
  }
  return JSON.parse(raw) as {
    AccessKeyId: string;
    SecretAccessKey: string;
    SessionToken: string;
    Expiration: string;
  };
})();

const credentialLifeMs = Date.parse(exported.Expiration) - Date.now();
if (credentialLifeMs < REQUIRED_CREDENTIAL_LIFE_MS) {
  throw new Error(
    `AWS credentials from profile ${AWS_PROFILE} expire at ${exported.Expiration}, ` +
      `in ${Math.round(credentialLifeMs / 60_000)} minutes. That is too little to ` +
      `finish a run. Refresh with \`aws sso login --profile ${AWS_PROFILE}\` first.`,
  );
}

// Runs the ready-for-agent frontier of Rakurai/crap-fiction one ticket at a time.
// Invoked from the repo root: ./.sandcastle/node_modules/.bin/tsx .sandcastle/main.mts

await run({
  name: "worker",

  // Claude Code on AWS Bedrock, using the session credentials minted above.
  // Passed as keys rather than a profile: there is no AWS config inside the
  // sandbox for a profile name to resolve against, by design.
  agent: claudeCode("us.anthropic.claude-sonnet-5", {
    env: {
      CLAUDE_CODE_USE_BEDROCK: "1",
      AWS_REGION: "us-east-1",
      AWS_ACCESS_KEY_ID: exported.AccessKeyId,
      AWS_SECRET_ACCESS_KEY: exported.SecretAccessKey,
      AWS_SESSION_TOKEN: exported.SessionToken,
      // Blank the other provider paths so Claude Code cannot try one of them.
      ANTHROPIC_API_KEY: "",
      CLAUDE_CODE_OAUTH_TOKEN: "",
      ANTHROPIC_BASE_URL: "",
      CLAUDE_CODE_USE_VERTEX: "",
      CLAUDE_CODE_USE_FOUNDRY: "",
    },
  }),

  sandbox: docker({
    // Named explicitly. Left unset, Sandcastle derives it from the repository
    // directory name, which is `writer` and not what the image was built as.
    imageName: "crap-fiction-sandcastle",

    // No mounts. Bedrock auth arrives as session credentials in the agent's
    // environment, and `gh` authenticates from GH_TOKEN in .env, so neither
    // ~/.aws nor ~/.config/gh needs to be visible from inside the sandbox.
    env: {
      // host.docker.internal reaches the host's CNTLM; 127.0.0.1 here would be
      // the container itself. Both cases set, because some tools read only one.
      HTTP_PROXY: "http://host.docker.internal:3128",
      HTTPS_PROXY: "http://host.docker.internal:3128",
      ALL_PROXY: "http://host.docker.internal:3128",
      http_proxy: "http://host.docker.internal:3128",
      https_proxy: "http://host.docker.internal:3128",
      all_proxy: "http://host.docker.internal:3128",
      NO_PROXY: "localhost,127.0.0.1",
      no_proxy: "localhost,127.0.0.1",
    },
  }),

  promptFile: "./.sandcastle/prompt.md",

  maxIterations: 10,

  // Commits accumulate on one agent branch for review before anything reaches
  // main. Nothing merges on its own.
  branchStrategy: { type: "branch", branch: "agent/build" },

  logging: { type: "file", path: ".sandcastle/logs/worker.log", verbose: true },

  // No copyToWorktree and no install hook: this repository has no package.json
  // yet, and both would fail before the agent started. Once the ticket that
  // establishes the substrate has landed, add
  //   copyToWorktree: ["node_modules"],
  //   hooks: { sandbox: { onSandboxReady: [{ command: "npm ci" }] } },
  // so an iteration does not reinstall from scratch.
});
