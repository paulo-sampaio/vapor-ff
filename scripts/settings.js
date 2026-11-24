(function () {
  "use strict";

  const DEFAULT_API_URL = "https://vapor.kirimure.io";
  const LEGACY_API_ORIGINS = new Set(["https://vapor.nargothrond.pub"]);

  const state = {
    cpu: null,
    gpu: null,
    ramGb: 16,
    apiUrl: DEFAULT_API_URL
  };

  function normalizeApiUrl(raw) {
    const trimmed = String(raw || "").trim().replace(/\/+$/, "");
    if (!trimmed) {
      return DEFAULT_API_URL;
    }
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("API URL must use http:// or https://");
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, "");
  }

  function isDefaultApiOrigin(origin) {
    return origin === new URL(DEFAULT_API_URL).origin;
  }

  async function ensureOriginPermission(normalizedUrl) {
    const origin = new URL(normalizedUrl).origin;
    if (!isDefaultApiOrigin(origin) && browser.permissions?.request) {
      return browser.permissions.request({
        origins: [`${origin}/*`]
      });
    }
    return true;
  }

  function clearChildren(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function setupAutocomplete(kind) {
    const input = document.getElementById(`${kind}-input`);
    const listbox = document.getElementById(`${kind}-listbox`);
    const selectedWrap = document.getElementById(`${kind}-selected`);
    const selectedName = document.getElementById(`${kind}-selected-name`);
    const clearBtn = document.getElementById(`${kind}-clear`);

    let timer = null;
    let items = [];
    let activeIdx = -1;
    let searchSeq = 0;
    let interactingWithList = false;
    let blurTimer = null;

    function syncSelectedBadge() {
      const sel = state[kind];
      if (sel && sel.id) {
        selectedName.textContent = sel.name;
        selectedWrap.hidden = false;
      } else {
        selectedName.textContent = "";
        selectedWrap.hidden = true;
      }
    }

    function closeList() {
      listbox.hidden = true;
      input.setAttribute("aria-expanded", "false");
      activeIdx = -1;
    }

    function selectItem(item) {
      searchSeq += 1;
      state[kind] = { id: item.id, name: item.name };
      input.value = item.name;
      syncSelectedBadge();
      closeList();
    }

    function renderList() {
      clearChildren(listbox);
      if (items.length === 0) {
        closeList();
        return;
      }
      items.forEach((item, idx) => {
        const li = document.createElement("li");
        li.className = "vapor-option";
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", idx === activeIdx ? "true" : "false");

        const nameSpan = document.createElement("span");
        nameSpan.textContent = item.name;
        const vendorSpan = document.createElement("span");
        vendorSpan.className = "vapor-option-vendor";
        vendorSpan.textContent = item.vendor || "";

        li.appendChild(nameSpan);
        li.appendChild(vendorSpan);
        li.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "mouse") {
            e.preventDefault();
          }
        });
        li.addEventListener("click", () => {
          selectItem(item);
        });
        listbox.appendChild(li);
      });
      listbox.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    async function runSearch(query, seq) {
      let apiUrl = DEFAULT_API_URL;
      try {
        apiUrl = normalizeApiUrl(document.getElementById("api-url-input").value);
      } catch {
        apiUrl = DEFAULT_API_URL;
      }

      const resp = await browser.runtime.sendMessage({
        action: "vapor:search",
        type: kind,
        q: query,
        limit: 15,
        apiUrl
      });
      if (seq !== searchSeq) {
        return;
      }
      if (!resp || !resp.ok || !Array.isArray(resp.data?.items)) {
        items = [];
        closeList();
        return;
      }
      items = resp.data.items;
      activeIdx = items.length > 0 ? 0 : -1;
      renderList();
    }

    input.addEventListener("input", () => {
      const q = input.value.trim();
      searchSeq += 1;
      const seq = searchSeq;
      if (state[kind] && q !== state[kind].name) {
        state[kind] = null;
        syncSelectedBadge();
      }
      clearTimeout(timer);
      if (q.length < 2) {
        items = [];
        closeList();
        return;
      }
      timer = setTimeout(() => runSearch(q, seq), 200);
    });

    input.addEventListener("keydown", (e) => {
      if (listbox.hidden || items.length === 0) {
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIdx = (activeIdx + 1) % items.length;
        renderList();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIdx = (activeIdx - 1 + items.length) % items.length;
        renderList();
      } else if (e.key === "Enter" && activeIdx >= 0 && items[activeIdx]) {
        e.preventDefault();
        selectItem(items[activeIdx]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeList();
      }
    });

    listbox.addEventListener("pointerdown", () => {
      interactingWithList = true;
      clearTimeout(blurTimer);
    });

    document.addEventListener("pointerup", () => {
      setTimeout(() => {
        interactingWithList = false;
      }, 0);
    });

    document.addEventListener("pointercancel", () => {
      setTimeout(() => {
        interactingWithList = false;
      }, 0);
    });

    document.addEventListener("pointerdown", (e) => {
      if (!listbox.hidden && !input.contains(e.target) && !listbox.contains(e.target)) {
        closeList();
      }
    });

    input.addEventListener("blur", () => {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (!interactingWithList) {
          closeList();
        }
      }, 150);
    });

    clearBtn.addEventListener("click", () => {
      searchSeq += 1;
      state[kind] = null;
      input.value = "";
      syncSelectedBadge();
      input.focus();
    });

    return { syncSelectedBadge, input };
  }

  function setupRamControls() {
    const ramInput = document.getElementById("ram-input");
    const pills = Array.from(document.querySelectorAll(".vapor-ram-pill"));

    function syncRamPills(val) {
      const num = Number(val);
      pills.forEach((p) => {
        const pVal = Number(p.getAttribute("data-ram"));
        p.classList.toggle("is-active", pVal === num);
      });
    }

    pills.forEach((pill) => {
      pill.addEventListener("click", () => {
        const val = Number(pill.getAttribute("data-ram"));
        state.ramGb = val;
        ramInput.value = String(val);
        syncRamPills(val);
      });
    });

    ramInput.addEventListener("input", () => {
      const val = Number(ramInput.value);
      state.ramGb = val;
      syncRamPills(val);
    });

    return { syncRamPills, ramInput };
  }

  function showSaveStatus(text, isError) {
    const el = document.getElementById("save-status");
    el.textContent = text;
    el.className = isError ? "vapor-status vapor-status--err" : "vapor-status vapor-status--ok";
    el.hidden = false;
  }

  async function init() {
    const cpuUI = setupAutocomplete("cpu");
    const gpuUI = setupAutocomplete("gpu");
    const ramUI = setupRamControls();
    const apiInput = document.getElementById("api-url-input");
    const testBtn = document.getElementById("test-conn-btn");
    const healthStatus = document.getElementById("health-status");
    const openFullBtn = document.getElementById("open-full-btn");

    if (openFullBtn) {
      openFullBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "vapor:openOptions" });
        window.close();
      });
    }

    const stored = await browser.storage.sync.get("vaporConfig");
    const cfg = stored?.vaporConfig;
    if (cfg) {
      if (cfg.cpu?.id) {
        state.cpu = { id: cfg.cpu.id, name: cfg.cpu.name || cfg.cpu.id };
        cpuUI.input.value = state.cpu.name;
      }
      if (cfg.gpu?.id) {
        state.gpu = { id: cfg.gpu.id, name: cfg.gpu.name || cfg.gpu.id };
        gpuUI.input.value = state.gpu.name;
      }
      if (Number(cfg.ramGb) > 0) {
        state.ramGb = Number(cfg.ramGb);
        ramUI.ramInput.value = String(state.ramGb);
      }
      if (cfg.apiUrl) {
        let loadedUrl = cfg.apiUrl;
        try {
          const parsed = new URL(cfg.apiUrl);
          if (LEGACY_API_ORIGINS.has(parsed.origin) && parsed.pathname.replace(/\/+$/, "") === "") {
            loadedUrl = DEFAULT_API_URL;
          }
        } catch {
          // Keep existing string so user can inspect/correct it.
        }
        state.apiUrl = loadedUrl;
        apiInput.value = loadedUrl;
      }
    }
    cpuUI.syncSelectedBadge();
    gpuUI.syncSelectedBadge();
    ramUI.syncRamPills(state.ramGb);

    testBtn.addEventListener("click", async () => {
      let url;
      try {
        url = normalizeApiUrl(apiInput.value);
      } catch (err) {
        healthStatus.textContent = err.message;
        return;
      }
      const granted = await ensureOriginPermission(url);
      if (!granted) {
        healthStatus.textContent = "Permission denied for custom API origin.";
        return;
      }
      healthStatus.textContent = "Testing...";
      const resp = await browser.runtime.sendMessage({
        action: "vapor:health",
        apiUrl: url
      });
      if (!resp || !resp.ok) {
        healthStatus.textContent = `Error: ${resp?.message || "Unreachable"}`;
        return;
      }
      const d = resp.data || {};
      if (d.status !== "ok" || !d.db_ready) {
        healthStatus.textContent = "Error: Unexpected health response";
        return;
      }
      const dateStr = d.generated_at ? String(d.generated_at).slice(0, 10) : "";
      healthStatus.textContent = `Connected \u2014 ${Number(d.cpu_count || 0).toLocaleString()} CPUs, ${Number(d.gpu_count || 0).toLocaleString()} GPUs (${d.source || "db"} ${dateStr})`;
    });

    document.getElementById("vapor-form").addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!state.cpu?.id) {
        showSaveStatus("Please select a CPU from the autocomplete list.", true);
        return;
      }
      if (!state.gpu?.id) {
        showSaveStatus("Please select a GPU from the autocomplete list.", true);
        return;
      }
      const ramVal = Number(ramUI.ramInput.value);
      if (!Number.isFinite(ramVal) || ramVal <= 0 || ramVal > 4096) {
        showSaveStatus("RAM must be between 1 and 4096 GB.", true);
        return;
      }

      let normalizedUrl;
      try {
        normalizedUrl = normalizeApiUrl(apiInput.value);
      } catch (err) {
        showSaveStatus(err.message, true);
        return;
      }

      const granted = await ensureOriginPermission(normalizedUrl);
      if (!granted) {
        showSaveStatus("Permission denied for custom API origin.", true);
        return;
      }

      await browser.storage.sync.set({
        vaporConfig: {
          cpu: state.cpu,
          gpu: state.gpu,
          ramGb: ramVal,
          apiUrl: normalizedUrl
        }
      });
      showSaveStatus("Saved. Open Steam tabs updated.", false);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
