import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productionWorkflow = readFileSync(
  new URL("../.github/workflows/cloudflare-pages.yml", import.meta.url),
  "utf8"
);
const betaWorkflow = readFileSync(
  new URL("../.github/workflows/cloudflare-pages-beta.yml", import.meta.url),
  "utf8"
);
const qualityWorkflow = readFileSync(
  new URL("../.github/workflows/citation-tests.yml", import.meta.url),
  "utf8"
);

test("production and beta deploy through isolated, fixed channels", () => {
  assert.match(productionWorkflow, /branches:\s*\n\s*- main/u);
  assert.doesNotMatch(productionWorkflow, /branches:\s*\n\s*- beta/u);
  assert.match(
    productionWorkflow,
    /CONCOURSE_DEPLOYMENT_ORIGIN: https:\/\/concoursehk\.com/u
  );
  assert.match(
    productionWorkflow,
    /pages deploy dist --project-name=concourse --branch=cloudflare-migration/u
  );

  assert.match(betaWorkflow, /branches:\s*\n\s*- beta/u);
  assert.doesNotMatch(betaWorkflow, /branches:\s*\n\s*- main/u);
  assert.match(
    betaWorkflow,
    /CONCOURSE_DEPLOYMENT_ORIGIN: https:\/\/beta\.concoursehk\.com/u
  );
  assert.match(
    betaWorkflow,
    /pages deploy dist --project-name=concourse --branch=beta/u
  );
  assert.notEqual(
    productionWorkflow.match(/group: ([^\n]+)/u)?.[1],
    betaWorkflow.match(/group: ([^\n]+)/u)?.[1]
  );
});

test("quality checks cover both release branches", () => {
  assert.match(qualityWorkflow, /push:\s*\n\s*branches: \[main, beta\]/u);
  assert.match(qualityWorkflow, /pull_request:\s*\n\s*branches: \[main, beta\]/u);
  assert.match(qualityWorkflow, /run: npm run check/u);
});
