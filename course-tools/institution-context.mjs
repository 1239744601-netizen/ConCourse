export const ACTIVE_USER_SESSION_KEY = "concourse_active_user_id_v1";
export const INSTITUTION_CONTEXT_SESSION_KEY =
  "concourse_institution_context_v1";
export const INSTITUTION_CONTEXT_VERSION = 1;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INSTITUTIONS = Object.freeze({
  hkbu: Object.freeze({
    id: "hkbu",
    name: "Hong Kong Baptist University",
    shortName: "HKBU",
    schoolKeys: Object.freeze([
      "hkbu",
      "ror:0145fw131",
      "domain:hkbu.edu.hk",
      "domain:life.hkbu.edu.hk"
    ]),
    schoolNames: Object.freeze([
      "HKBU",
      "Hong Kong Baptist University"
    ])
  }),
  bnbu: Object.freeze({
    id: "bnbu",
    name: "Beijing Normal–Hong Kong Baptist University",
    shortName: "BNBU",
    schoolKeys: Object.freeze([
      "bnbu",
      "domain:uic.edu.cn"
    ]),
    schoolNames: Object.freeze([
      "BNBU",
      "Beijing Normal–Hong Kong Baptist University"
    ])
  })
});

function clean(value, limit = 500) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function normalizeSchoolKey(value) {
  return clean(value).toLocaleLowerCase();
}

function normalizeSchoolName(value) {
  return clean(value)
    .toLocaleLowerCase()
    .replace(/[‐‑‒–—―-]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const KEY_ALIASES = new Map();
const NAME_ALIASES = new Map();
for (const institution of Object.values(INSTITUTIONS)) {
  for (const key of institution.schoolKeys) {
    KEY_ALIASES.set(normalizeSchoolKey(key), institution.id);
  }
  for (const name of institution.schoolNames) {
    NAME_ALIASES.set(normalizeSchoolName(name), institution.id);
  }
}

function result(status, institutionId = "", details = {}) {
  const institution = institutionId ? INSTITUTIONS[institutionId] : null;
  return Object.freeze({
    status,
    institutionId: institution?.id || "",
    institutionName: institution?.name || "",
    institutionShortName: institution?.shortName || "",
    ...details
  });
}

export function canonicalCatalogueInstitutionId(value) {
  const key = normalizeSchoolKey(value);
  return KEY_ALIASES.get(key) || key;
}

export function resolveCatalogueInstitution({
  schoolKey = "",
  schoolName = ""
} = {}) {
  const key = normalizeSchoolKey(schoolKey);
  const name = normalizeSchoolName(schoolName);
  if (!key && !name) return result("missing");

  const keyInstitution = key ? KEY_ALIASES.get(key) || "" : "";
  const nameInstitution = name ? NAME_ALIASES.get(name) || "" : "";

  // A supplied key is authoritative. Never infer a known institution from a
  // display name when the stored key is unknown or points somewhere else.
  if (key && !keyInstitution) {
    return result("unsupported", "", { schoolKey: key, schoolName: clean(schoolName, 240) });
  }
  if (keyInstitution && nameInstitution && keyInstitution !== nameInstitution) {
    return result("conflict", "", { schoolKey: key, schoolName: clean(schoolName, 240) });
  }

  const institutionId = keyInstitution || nameInstitution;
  return institutionId
    ? result("recognized", institutionId)
    : result("unsupported", "", {
      schoolKey: key,
      schoolName: clean(schoolName, 240)
    });
}

function readStorage(storage, key) {
  try {
    return storage?.getItem(key) || "";
  } catch (_error) {
    return "";
  }
}

export function readSignedInInstitutionContext(
  storage = globalThis.sessionStorage
) {
  const activeUserId = clean(
    readStorage(storage, ACTIVE_USER_SESSION_KEY),
    80
  ).toLocaleLowerCase();
  if (!UUID_PATTERN.test(activeUserId)) return result("signed_out");

  let payload;
  try {
    payload = JSON.parse(
      readStorage(storage, INSTITUTION_CONTEXT_SESSION_KEY) || "null"
    );
  } catch (_error) {
    return result("invalid");
  }
  if (!payload || Number(payload.version) !== INSTITUTION_CONTEXT_VERSION) {
    return result("missing");
  }

  const contextUserId = clean(payload.userId, 80).toLocaleLowerCase();
  if (!UUID_PATTERN.test(contextUserId) || contextUserId !== activeUserId) {
    return result("session_mismatch");
  }
  if (payload.verified !== true || clean(payload.status, 40).toLocaleLowerCase() !== "verified") {
    return result("unverified");
  }

  return resolveCatalogueInstitution({
    schoolKey: payload.schoolKey,
    schoolName: payload.schoolName
  });
}

export function institutionById(value) {
  return INSTITUTIONS[canonicalCatalogueInstitutionId(value)] || null;
}
