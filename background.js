const DEFAULT_API_URL = "https://vapor.kirimure.io";
const LEGACY_API_ORIGINS = new Set(["https://vapor.nargothrond.pub"]);
const REQUEST_TIMEOUT_MS = 8000;

function sanitizeApiBaseUrl(raw) {
  const trimmed = typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
  if (!trimmed) {
    return DEFAULT_API_URL;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return DEFAULT_API_URL;
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, "");
    if (LEGACY_API_ORIGINS.has(parsed.origin) && cleanPath === "") {
      return DEFAULT_API_URL;
    }
    return parsed.origin + cleanPath;
  } catch {
    return DEFAULT_API_URL;
  }
}

async function openOptionsSafe() {
  try {
    await browser.runtime.openOptionsPage();
  } catch {
    if (browser.tabs?.create) {
      await browser.tabs.create({ url: browser.runtime.getURL("options.html") });
    }
  }
}

browser.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") {
    await openOptionsSafe();
    return;
  }
  if (reason === "update") {
    const stored = await browser.storage.sync.get("vaporConfig");
    const cfg = stored?.vaporConfig;
    if (cfg && typeof cfg.apiUrl === "string" && cfg.apiUrl.trim()) {
      try {
        const parsed = new URL(cfg.apiUrl.trim());
        if (LEGACY_API_ORIGINS.has(parsed.origin) && parsed.pathname.replace(/\/+$/, "") === "") {
          await browser.storage.sync.set({
            vaporConfig: {
              ...cfg,
              apiUrl: DEFAULT_API_URL
            }
          });
        }
      } catch {
        // Ignore invalid stored URLs during update migration.
      }
    }
  }
});

async function getApiBaseUrl(overrideUrl) {
  if (typeof overrideUrl === "string" && overrideUrl.trim()) {
    return sanitizeApiBaseUrl(overrideUrl);
  }
  const stored = await browser.storage.sync.get("vaporConfig");
  return sanitizeApiBaseUrl(stored?.vaporConfig?.apiUrl);
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
    if (data === null || typeof data !== "object") {
      return {
        ok: false,
        errorType: "http",
        status: resp.status,
        message: "Invalid JSON response from API"
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

browser.runtime.onMessage.addListener((message, sender) => {
  if (sender && sender.id && sender.id !== browser.runtime.id) {
    return undefined;
  }
  if (!message || typeof message.action !== "string") {
    return undefined;
  }

  switch (message.action) {
    case "vapor:openOptions":
      return openOptionsSafe().then(() => ({ ok: true }));

    case "vapor:health":
      return (async () => {
        const base = await getApiBaseUrl(message.apiUrl);
        return fetchJson(`${base}/healthz`, { method: "GET" });
      })();

    case "vapor:search":
      return (async () => {
        const rawType = String(message.type || "");
        if (rawType !== "cpu" && rawType !== "gpu") {
          return {
            ok: false,
            errorType: "http",
            status: 400,
            message: "Invalid hardware type"
          };
        }
        const base = await getApiBaseUrl(message.apiUrl);
        const type = encodeURIComponent(rawType);
        const q = encodeURIComponent(String(message.q || ""));
        const limit = Math.min(30, Math.max(1, Math.trunc(Number(message.limit) || 15)));
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
