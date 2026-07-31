(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.ConCourseInstitutionPortalPolicy = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function(){
    "use strict";

    const DEFAULT_CONNECTORS = Object.freeze([
      Object.freeze({
        id:"hkbu",
        catalogueId:"hkbu",
        importAdapterId:"hkbu",
        schoolKeys:Object.freeze([
          "ror:0145fw131",
          "domain:hkbu.edu.hk",
          "domain:life.hkbu.edu.hk"
        ])
      })
    ]);

    function clean(value, max=500){
      return String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, max);
    }

    function normalizedConnectors(value){
      const source = Array.isArray(value) ? value : DEFAULT_CONNECTORS;
      return source.slice(0, 50).map((connector, index) => {
        const id = clean(connector?.id, 80).toLowerCase();
        if(!id || !/^[a-z][a-z0-9_-]{0,79}$/u.test(id)){
          throw new TypeError(`Connector ${index} has an invalid id`);
        }
        const keys = Array.isArray(connector?.schoolKeys)
          ? connector.schoolKeys
          : Array.isArray(connector?.school_keys)
            ? connector.school_keys
            : [];
        const schoolKeys = Array.from(new Set(
          keys.slice(0, 200)
            .map(key => clean(key, 500).toLowerCase())
            .filter(Boolean)
        ));
        if(!schoolKeys.length){
          throw new TypeError(`Connector ${id} requires at least one school key`);
        }
        const has = key => Object.prototype.hasOwnProperty.call(connector || {}, key);
        const catalogueValue = has("catalogueId")
          ? connector.catalogueId
          : has("catalogue_id") ? connector.catalogue_id : undefined;
        const catalogueId = catalogueValue === null || catalogueValue === false
          ? null
          : clean(catalogueValue ?? id, 80).toLowerCase();
        const importValue = has("importAdapterId")
          ? connector.importAdapterId
          : has("import_adapter_id") ? connector.import_adapter_id : undefined;
        const importAdapterId = importValue === null || importValue === false
          ? null
          : clean(importValue ?? id, 80).toLowerCase();
        for(const [field, value] of [
          ["catalogueId", catalogueId],
          ["importAdapterId", importAdapterId]
        ]){
          if(value != null && !/^[a-z][a-z0-9_-]{0,79}$/u.test(value)){
            throw new TypeError(`Connector ${id} has an invalid ${field}`);
          }
        }
        if(!catalogueId && !importAdapterId){
          throw new TypeError(`Connector ${id} requires a catalogue or import capability`);
        }
        return Object.freeze({
          id,
          catalogueId:catalogueId || null,
          importAdapterId:importAdapterId || null,
          schoolKeys:Object.freeze(schoolKeys)
        });
      });
    }

    function resolveInstitution(membership, {connectors=DEFAULT_CONNECTORS}={}){
      const rawStatus = clean(membership?.status, 40).toLowerCase();
      const status = ["verified", "pending", "rejected", "revoked"].includes(rawStatus)
        ? rawStatus
        : "unverified";
      const candidateName = clean(
        membership?.schoolName ?? membership?.school_name,
        240
      );
      const candidateKey = clean(
        membership?.schoolKey ?? membership?.school_key,
        500
      ).toLowerCase();
      const verified = status === "verified"
        && candidateName.length >= 2
        && candidateKey.length >= 2;
      const schoolName = verified ? candidateName : "";
      const schoolKey = verified ? candidateKey : "";
      const connector = verified
        ? normalizedConnectors(connectors).find(item => item.schoolKeys.includes(schoolKey)) || null
        : null;

      return Object.freeze({
        status,
        verified,
        schoolName,
        schoolKey,
        connectorId:connector?.id || null,
        catalogueId:connector?.catalogueId || null,
        importAdapterId:connector?.importAdapterId || null,
        catalogueAvailable:Boolean(connector?.catalogueId),
        importAvailable:Boolean(connector?.importAdapterId),
        isSupported:Boolean(connector)
      });
    }

    return Object.freeze({
      DEFAULT_CONNECTORS,
      resolveInstitution
    });
  }
);
