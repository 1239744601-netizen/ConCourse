import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const policy = require("../institution-portal-policy.js");

test("non-verified or incomplete membership never exposes a school or connector", () => {
  for(const membership of [
    null,
    {
      status:"pending",
      school_name:"Hong Kong Baptist University",
      school_key:"domain:hkbu.edu.hk"
    },
    {
      status:"rejected",
      school_name:"Hong Kong Baptist University",
      school_key:"domain:hkbu.edu.hk"
    },
    {
      status:"revoked",
      school_name:"Hong Kong Baptist University",
      school_key:"domain:hkbu.edu.hk"
    },
    {
      status:"verified",
      school_name:"Hong Kong Baptist University",
      school_key:""
    }
  ]){
    const result = policy.resolveInstitution(membership);
    assert.equal(result.verified, false);
    assert.equal(result.schoolName, "");
    assert.equal(result.schoolKey, "");
    assert.equal(result.connectorId, null);
    assert.equal(result.catalogueId, null);
    assert.equal(result.importAdapterId, null);
    assert.equal(result.catalogueAvailable, false);
    assert.equal(result.importAvailable, false);
    assert.equal(result.isSupported, false);
  }
});

test("a verified supported membership preserves the authoritative exact school name", () => {
  const result = policy.resolveInstitution({
    status:"verified",
    school_name:"Hong Kong Baptist University",
    school_key:"ror:0145fw131"
  });
  assert.equal(result.verified, true);
  assert.equal(result.schoolName, "Hong Kong Baptist University");
  assert.equal(result.schoolKey, "ror:0145fw131");
  assert.equal(result.connectorId, "hkbu");
  assert.equal(result.catalogueId, "hkbu");
  assert.equal(result.importAdapterId, "hkbu");
  assert.equal(result.catalogueAvailable, true);
  assert.equal(result.importAvailable, true);
  assert.equal(result.isSupported, true);
});

test("HKBU domain memberships remain supported for existing verified records", () => {
  for(const schoolKey of ["domain:hkbu.edu.hk", "domain:life.hkbu.edu.hk"]){
    const result = policy.resolveInstitution({
      status:"verified",
      school_name:"Hong Kong Baptist University",
      school_key:schoolKey
    });
    assert.equal(result.connectorId, "hkbu");
    assert.equal(result.isSupported, true);
  }
});

test("a verified unsupported institution keeps its exact name without unlocking HKBU", () => {
  const result = policy.resolveInstitution({
    status:"verified",
    school_name:"University of Hong Kong",
    school_key:"domain:hku.hk"
  });
  assert.equal(result.verified, true);
  assert.equal(result.schoolName, "University of Hong Kong");
  assert.equal(result.schoolKey, "domain:hku.hk");
  assert.equal(result.connectorId, null);
  assert.equal(result.catalogueId, null);
  assert.equal(result.importAdapterId, null);
  assert.equal(result.catalogueAvailable, false);
  assert.equal(result.importAvailable, false);
  assert.equal(result.isSupported, false);
});

test("lookalike school names cannot unlock a connector without an allowlisted key", () => {
  const result = policy.resolveInstitution({
    status:"verified",
    school_name:"HKBU Example College",
    school_key:"domain:example.edu"
  });
  assert.equal(result.verified, true);
  assert.equal(result.connectorId, null);
  assert.equal(result.isSupported, false);
});

test("an intentionally empty connector registry fails closed", () => {
  const result = policy.resolveInstitution(
    {
      status:"verified",
      school_name:"Hong Kong Baptist University",
      school_key:"ror:0145fw131"
    },
    {connectors:[]}
  );
  assert.equal(result.verified, true);
  assert.equal(result.schoolName, "Hong Kong Baptist University");
  assert.equal(result.connectorId, null);
  assert.equal(result.catalogueId, null);
  assert.equal(result.importAdapterId, null);
  assert.equal(result.isSupported, false);
});

test("catalogue and optional personal-import capabilities are independently gated", () => {
  const membership = {
    status:"verified",
    school_name:"Example University",
    school_key:"domain:example.edu"
  };
  const catalogueOnly = policy.resolveInstitution(membership, {
    connectors:[{
      id:"example",
      catalogueId:"example-catalogue",
      importAdapterId:null,
      schoolKeys:["domain:example.edu"]
    }]
  });
  assert.equal(catalogueOnly.catalogueId, "example-catalogue");
  assert.equal(catalogueOnly.importAdapterId, null);
  assert.equal(catalogueOnly.catalogueAvailable, true);
  assert.equal(catalogueOnly.importAvailable, false);

  const importOnly = policy.resolveInstitution(membership, {
    connectors:[{
      id:"example",
      catalogueId:null,
      importAdapterId:"example-import",
      schoolKeys:["domain:example.edu"]
    }]
  });
  assert.equal(importOnly.catalogueId, null);
  assert.equal(importOnly.importAdapterId, "example-import");
  assert.equal(importOnly.catalogueAvailable, false);
  assert.equal(importOnly.importAvailable, true);
});

test("the policy defaults custom connector capability ids to its exact id", () => {
  const result = policy.resolveInstitution(
    {
      status:"verified",
      school_name:"Example University",
      school_key:"domain:example.edu"
    },
    {
      connectors:[{
        id:"example",
        schoolKeys:["domain:example.edu"]
      }]
    }
  );
  assert.equal(result.connectorId, "example");
  assert.equal(result.catalogueId, "example");
  assert.equal(result.importAdapterId, "example");
  assert.equal(result.catalogueAvailable, true);
  assert.equal(result.importAvailable, true);
  assert.equal(result.isSupported, true);
});
