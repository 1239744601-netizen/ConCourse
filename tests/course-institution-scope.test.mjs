import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ACTIVE_USER_SESSION_KEY,
  INSTITUTION_CONTEXT_SESSION_KEY,
  INSTITUTION_CONTEXT_VERSION,
  readSignedInInstitutionContext,
  resolveCatalogueInstitution
} from "../course-tools/institution-context.mjs";
import {
  adaptCourseKeysCatalogue,
  loadSelectionAssistantCatalogue
} from "../course-tools/course-tools.mjs";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function storageFor({
  userId = USER_ID,
  contextUserId = USER_ID,
  verified = true,
  status = "verified",
  schoolKey = "",
  schoolName = ""
} = {}) {
  const values = new Map([
    [ACTIVE_USER_SESSION_KEY, userId],
    [INSTITUTION_CONTEXT_SESSION_KEY, JSON.stringify({
      version: INSTITUTION_CONTEXT_VERSION,
      userId: contextUserId,
      verified,
      status,
      schoolKey,
      schoolName
    })]
  ]);
  return {
    getItem(key) {
      return values.get(key) || null;
    }
  };
}

function publicBnbuFetch(requests = []) {
  return async (url) => {
    requests.push(String(url));
    return {
      ok: true,
      async json() {
        return {
          institutions: [{
            id: "bnbu",
            name: "Beijing Normal–Hong Kong Baptist University",
            shortName: "BNBU",
            status: "reference"
          }],
          courses: [{
            institutionId: "bnbu",
            sourceCourseId: "42",
            title: "FIN3010 Corporate Finance",
            academicPeriod: "Semester 1"
          }]
        };
      }
    };
  };
}

test("normalizes only exact recognized HKBU and BNBU identities", () => {
  assert.equal(
    resolveCatalogueInstitution({
      schoolKey: "ROR:0145FW131",
      schoolName: "Hong Kong Baptist University"
    }).institutionId,
    "hkbu"
  );
  assert.equal(
    resolveCatalogueInstitution({
      schoolName: "Beijing Normal-Hong Kong Baptist University"
    }).institutionId,
    "bnbu"
  );
  assert.equal(
    resolveCatalogueInstitution({
      schoolKey: "domain:uic.edu.cn",
      schoolName: "BNBU"
    }).institutionId,
    "bnbu"
  );
  assert.equal(
    resolveCatalogueInstitution({
      schoolKey: "domain:example.edu",
      schoolName: "Hong Kong Baptist University"
    }).status,
    "unsupported",
    "a familiar display name must not override an unknown school key"
  );
  assert.equal(
    resolveCatalogueInstitution({
      schoolKey: "bnbu",
      schoolName: "Hong Kong Baptist University"
    }).status,
    "conflict"
  );
  assert.equal(
    resolveCatalogueInstitution({
      schoolName: "HKBU Example College"
    }).status,
    "unsupported",
    "institution matching must not use substrings"
  );
});

test("binds stored institution context to the active signed-in user", () => {
  assert.equal(
    readSignedInInstitutionContext(storageFor({
      schoolKey: "domain:hkbu.edu.hk",
      schoolName: "Hong Kong Baptist University"
    })).institutionId,
    "hkbu"
  );
  assert.equal(
    readSignedInInstitutionContext(storageFor({
      contextUserId: "22222222-2222-4222-8222-222222222222",
      schoolKey: "bnbu"
    })).status,
    "session_mismatch"
  );
  assert.equal(
    readSignedInInstitutionContext(storageFor({
      verified: false,
      status: "pending",
      schoolKey: "bnbu"
    })).status,
    "unverified"
  );
});

test("never guesses BNBU when a catalogue record omits institutionId", () => {
  assert.throws(
    () => adaptCourseKeysCatalogue({
      institutions: [{ id: "bnbu" }],
      courses: [{ sourceCourseId: "42", title: "Missing institution" }]
    }),
    /missing institutionId/
  );
});

test("scopes semester selection to the recognized signed-in institution", async () => {
  const catalogue = await loadSelectionAssistantCatalogue({
    storage: storageFor({
      schoolKey: "bnbu",
      schoolName: "Beijing Normal–Hong Kong Baptist University"
    }),
    locationLike: { hostname: "concoursehk.pages.dev" },
    fetchImpl: publicBnbuFetch()
  });

  assert.equal(catalogue.institution.institutionId, "bnbu");
  assert.deepEqual(
    [...new Set(catalogue.courses.map((course) => course.institutionId))],
    ["bnbu"]
  );
});

test("fails closed for HKBU on production instead of showing BNBU courses", async () => {
  const requests = [];
  await assert.rejects(
    loadSelectionAssistantCatalogue({
      storage: storageFor({
        schoolKey: "domain:life.hkbu.edu.hk",
        schoolName: "Hong Kong Baptist University"
      }),
      locationLike: { hostname: "concoursehk.pages.dev" },
      fetchImpl: publicBnbuFetch(requests)
    }),
    (error) =>
      error?.code === "institution_catalogue_unavailable" &&
      error?.institution?.institutionId === "hkbu"
  );
  assert.equal(requests.length, 1);
  assert.doesNotMatch(
    requests.join("\n"),
    /hkbu-catalogue-current|hkbu-2026/i
  );
});

test("requires a recognized institution before fetching semester courses", async () => {
  let fetched = false;
  await assert.rejects(
    loadSelectionAssistantCatalogue({
      storage: {
        getItem(key) {
          return key === ACTIVE_USER_SESSION_KEY ? USER_ID : null;
        }
      },
      fetchImpl: async () => {
        fetched = true;
        throw new Error("must not fetch");
      }
    }),
    (error) => error?.code === "institution_required"
  );
  assert.equal(fetched, false);
});

test("persists verified membership context and renders broad Engine results by institution", async () => {
  const [root, memberHub, assistant, engine] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../member-hub.js", import.meta.url), "utf8"),
    readFile(new URL("../assistant/assistant.mjs", import.meta.url), "utf8"),
    readFile(new URL("../courses/courses.mjs", import.meta.url), "utf8")
  ]);

  assert.match(memberHub, /concourse_institution_context_v1/);
  assert.match(memberHub, /userId:String\(currentUser\.id\)\.toLowerCase\(\)/);
  assert.match(memberHub, /schoolName:context\.schoolName/);
  assert.match(memberHub, /schoolKey:context\.schoolKey/);
  assert.match(root, /INSTITUTION_CONTEXT_STORAGE_KEY = "concourse_institution_context_v1"/);
  assert.match(
    root,
    /from\("school_memberships"\)[\s\S]*?verification_method, verified_at/
  );
  assert.match(
    root,
    /membership\?\.verification_method === "academic_email"[\s\S]*?sessionStorage\.setItem\(INSTITUTION_CONTEXT_STORAGE_KEY/
  );
  assert.match(
    root,
    /sessionStorage\.removeItem\(INSTITUTION_CONTEXT_STORAGE_KEY\)/
  );
  assert.match(assistant, /loadSelectionAssistantCatalogue/);
  assert.match(assistant, /institution_catalogue_unavailable/);
  assert.match(assistant, /manually in Timetable/);
  assert.match(engine, /course-institution-group/);
  assert.match(engine, /institutionResults/);
});
