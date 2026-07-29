(() => {
  "use strict";

  const STORAGE_KEY = "hkbuPortalConnector.schemaV1";
  const EVENT_NAME = "concourse:hkbu-portal-snapshot";
  const CONCOURSE_ORIGINS = new Set([
    "https://concoursehk.pages.dev",
    "https://concourse-95c.pages.dev"
  ]);
  const SUPPORTED_HOSTS = new Set([
    "buniport.hkbu.edu.hk",
    "buniport03.hkbu.edu.hk",
    "iss.hkbu.edu.hk"
  ]);

  const elements = {
    connectionState:document.getElementById("connectionState"),
    statusDot:document.getElementById("statusDot"),
    pageContext:document.getElementById("pageContext"),
    message:document.getElementById("message"),
    scanButton:document.getElementById("scanButton"),
    sendButton:document.getElementById("sendButton"),
    purgeButton:document.getElementById("purgeButton"),
    previewCard:document.getElementById("previewCard"),
    previewCount:document.getElementById("previewCount"),
    preview:document.getElementById("preview")
  };

  let storedPayload = null;
  let activeTab = null;
  let activeContext = "other";

  function setMessage(text, success = false) {
    elements.message.textContent = text;
    elements.message.classList.toggle("success", success);
  }

  function tabUrl(tab) {
    try {
      return new URL(tab?.url || "");
    } catch {
      return null;
    }
  }

  function isSupportedHKBU(url) {
    return Boolean(url && url.protocol === "https:" && SUPPORTED_HOSTS.has(url.hostname));
  }

  function hasResolvedTerm(payload) {
    const term = String(payload?.source?.term || "");
    return Boolean(term && term !== "unknown" && term !== "multiple");
  }

  function previewPayload(payload) {
    if (!payload) {
      elements.previewCard.hidden = true;
      elements.preview.textContent = "";
      elements.previewCount.textContent = "";
      return;
    }
    const assigned = Array.isArray(payload.assigned_courses) ? payload.assigned_courses : [];
    const completed = Array.isArray(payload.completed_courses) ? payload.completed_courses : [];
    const requirements = Array.isArray(payload.remaining_requirements) ? payload.remaining_requirements : [];
    const catalogue = Array.isArray(payload.catalogue_courses) ? payload.catalogue_courses : [];
    const preview = {
      ...payload,
      assigned_courses:assigned.slice(0, 4),
      completed_courses:completed.slice(0, 4),
      remaining_requirements:requirements.slice(0, 4),
      catalogue_courses:catalogue.slice(0, 4)
    };
    const total = assigned.length + completed.length + requirements.length + catalogue.length;
    const shown = Math.min(assigned.length, 4)
      + Math.min(completed.length, 4)
      + Math.min(requirements.length, 4)
      + Math.min(catalogue.length, 4);
    elements.preview.textContent = `${JSON.stringify(preview, null, 2)}${total > shown ? `\n\n… ${total - shown} more academic records` : ""}`;
    elements.previewCount.textContent = `${assigned.length} assigned · ${completed.length} completed · ${requirements.length} requirements · ${catalogue.length} catalogue`;
    elements.previewCard.hidden = false;
  }

  function render() {
    const hasPayload = Boolean(storedPayload);
    elements.connectionState.textContent = hasPayload
      ? `Snapshot ready · ${storedPayload.source.captured_at.slice(0, 16).replace("T", " ")} UTC`
      : "No snapshot in this browser session";
    elements.statusDot.classList.toggle("ready", hasPayload);
    elements.purgeButton.disabled = !hasPayload;
    elements.scanButton.disabled = activeContext !== "hkbu";
    elements.sendButton.disabled = !hasPayload || !hasResolvedTerm(storedPayload) || activeContext !== "concourse";
    previewPayload(storedPayload);

    if (activeContext === "hkbu") {
      elements.pageContext.textContent = "Supported HKBU page. Scan runs only when you click.";
    } else if (activeContext === "concourse" && hasPayload && !hasResolvedTerm(storedPayload)) {
      elements.pageContext.textContent = "Term unresolved. Scan an HKBU page that visibly shows the selected semester before sending.";
    } else if (activeContext === "concourse") {
      elements.pageContext.textContent = "ConCourse detected. A ready snapshot can be sent with one click.";
    } else {
      elements.pageContext.textContent = "Open a supported HKBU page to scan, or a ConCourse page to send.";
    }
  }

  async function currentTab() {
    const tabs = await chrome.tabs.query({active:true, currentWindow:true});
    return tabs[0] || null;
  }

  async function probeConcourse(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target:{tabId},
        func:() => {
          const description = document.querySelector("meta[name='description']")?.content || "";
          return {
            origin:location.origin,
            protocol:location.protocol,
            title:document.title || "",
            description
          };
        }
      });
      const probe = results?.[0]?.result;
      return Boolean(
        probe
        && CONCOURSE_ORIGINS.has(probe.origin)
        && probe.protocol === "https:"
        && /\bConCourse\b/u.test(probe.title)
        && /\bConCourse\b/u.test(probe.description)
      );
    } catch {
      return false;
    }
  }

  async function refreshContext() {
    activeTab = await currentTab();
    const url = tabUrl(activeTab);
    if (isSupportedHKBU(url)) {
      activeContext = "hkbu";
    } else if (activeTab?.id && await probeConcourse(activeTab.id)) {
      activeContext = "concourse";
    } else {
      activeContext = "other";
    }
    render();
  }

  async function loadSession() {
    try {
      await chrome.storage.session.setAccessLevel?.({accessLevel:"TRUSTED_CONTEXTS"});
    } catch {
      // Chrome session storage is trusted-context-only by default.
    }
    const data = await chrome.storage.session.get(STORAGE_KEY);
    storedPayload = data[STORAGE_KEY] || null;
  }

  async function scanPage() {
    setMessage("");
    activeTab = await currentTab();
    const url = tabUrl(activeTab);
    if (!activeTab?.id || !isSupportedHKBU(url)) {
      setMessage("Scan stopped: this is not one of the three supported HTTPS HKBU hosts.");
      return;
    }

    elements.scanButton.disabled = true;
    elements.scanButton.textContent = "Scanning visible tables…";
    try {
      await chrome.scripting.executeScript({
        target:{tabId:activeTab.id},
        files:["parser.js"]
      });
      const results = await chrome.scripting.executeScript({
        target:{tabId:activeTab.id},
        func:() => globalThis.HKBUPortalParser?.scanDocument(document, {
          origin:location.origin,
          capturedAt:new Date().toISOString()
        }) || {ok:false, code:"parser_unavailable"}
      });
      const result = results?.[0]?.result;
      if (!result?.ok || !result.payload) {
        setMessage(
          result?.code === "unsupported_structure"
            ? "Nothing imported. This page does not contain a recognised visible course or requirement table."
            : "Nothing imported. The helper could not safely recognise this page."
        );
        return;
      }
      storedPayload = globalThis.HKBUPortalParser?.mergeSnapshots(storedPayload, result.payload)
        || result.payload;
      await chrome.storage.session.set({[STORAGE_KEY]:storedPayload});
      setMessage("Redacted page data merged into the session snapshot. Review it before sending.", true);
    } catch {
      setMessage("Scan stopped safely. Reload the HKBU page and try again.");
    } finally {
      elements.scanButton.textContent = "Scan this HKBU page";
      render();
    }
  }

  async function sendToConcourse() {
    setMessage("");
    if (!storedPayload) {
      setMessage("There is no session snapshot to send.");
      return;
    }
    if (!hasResolvedTerm(storedPayload)) {
      setMessage("Send stopped: the snapshot needs one unambiguous semester term.");
      return;
    }

    activeTab = await currentTab();
    if (!activeTab?.id || !await probeConcourse(activeTab.id)) {
      activeContext = "other";
      render();
      setMessage("Send stopped: this tab does not identify itself as ConCourse.");
      return;
    }

    elements.sendButton.disabled = true;
    elements.sendButton.textContent = "Sending…";
    try {
      const results = await chrome.scripting.executeScript({
        target:{tabId:activeTab.id},
        world:"MAIN",
        func:(eventName, payload) => {
          const copy = JSON.parse(JSON.stringify(payload));
          return window.dispatchEvent(new CustomEvent(eventName, {detail:copy}));
        },
        args:[EVENT_NAME, storedPayload]
      });
      if (!results?.length) throw new Error("No receiver context");
      setMessage("Snapshot sent to this ConCourse tab. It remains marked unverified.", true);
    } catch {
      setMessage("Send failed safely. Reload ConCourse and try again.");
    } finally {
      elements.sendButton.textContent = "Send to this ConCourse tab";
      render();
    }
  }

  async function purgeSession() {
    await chrome.storage.session.remove(STORAGE_KEY);
    storedPayload = null;
    render();
    setMessage("Disconnected. The session snapshot has been purged.", true);
  }

  elements.scanButton.addEventListener("click", scanPage);
  elements.sendButton.addEventListener("click", sendToConcourse);
  elements.purgeButton.addEventListener("click", purgeSession);

  Promise.all([loadSession(), refreshContext()])
    .then(render)
    .catch(() => {
      setMessage("The helper could not initialise. Close and reopen it.");
      render();
    });
})();
