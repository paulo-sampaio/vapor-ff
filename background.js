const DEFAULT_API_URL = "https://vapor.nargothrond.pub";
const REQUEST_TIMEOUT_MS = 8000;

browser.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    browser.runtime.openOptionsPage();
  }
});

async function getApiBaseUrl(overrideUrl) {
  if (typeof overrideUrl === "string" && overrideUrl.trim()) {
    return overrideUrl.trim().replace(/\/+$/, "");
  }
  const stored = await browser.storage.sync.get("vaporConfig");
  const url = stored?.vaporConfig?.apiUrl;
  if (typeof url === "string" && url.trim()) {
    return url.trim().replace(/\/+$/, "");
  }
  return DEFAULT_API_URL;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await resp.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!resp.ok) {
      return {
        ok: false,
        errorType: "http",
        status: resp.status,
        message: data?.error?.message || `HTTP ${resp.status}`
      };
    }
    return { ok: true, status: resp.status, data };
  } catch (err) {
    return {
      ok: false,
      errorType: "network",
      status: 0,
      message: err?.name === "AbortError" ? "Request timed out" : (err?.message || "Network error")
    };
  } finally {
    clearTimeout(timer);
  }
}

browser.runtime.onMessage.addListener((message) => {
  if (!message || typeof message.action !== "string") {
    return undefined;
  }

  switch (message.action) {
    case "vapor:openOptions":
      return browser.runtime.openOptionsPage().then(() => ({ ok: true }));

    case "vapor:health":
      return (async () => {
        const base = await getApiBaseUrl(message.apiUrl);
        return fetchJson(`${base}/healthz`, { method: "GET" });
      })();

    case "vapor:search":
      return (async () => {
        const base = await getApiBaseUrl(message.apiUrl);
        const type = encodeURIComponent(String(message.type || ""));
        const q = encodeURIComponent(String(message.q || ""));
        const limit = Number(message.limit) || 15;
        return fetchJson(`${base}/api/v1/hardware/search?type=${type}&q=${q}&limit=${limit}`, {
          method: "GET"
        });
      })();

    case "vapor:compare":
      return (async () => {
        const base = await getApiBaseUrl(message.apiUrl);
        return fetchJson(`${base}/api/v1/compare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message.payload)
        });
      })();

    default:
      return undefined;
  }
});
