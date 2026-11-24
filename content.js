(function () {
  "use strict";

  const DOM = globalThis.VaporSteamDOM;
  if (!DOM) {
    return;
  }

  const DEFAULT_API_URL = "https://vapor.kirimure.io";
  let runSeq = 0;

  function isCoarsePointer() {
    return Boolean(window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches);
  }

  function closeAllTooltips(exceptWrap) {
    document.querySelectorAll(".vapor-pill-wrap.is-open").forEach((wrap) => {
      if (wrap !== exceptWrap) {
        wrap.classList.remove("is-open");
      }
    });
  }

  function positionTooltip(wrap) {
    const tip = wrap?.querySelector?.(".vapor-tooltip");
    if (!tip) {
      return;
    }
    tip.style.left = "";
    const rect = tip.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const margin = 12;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    let delta = 0;
    if (rect.right > viewportWidth - margin) {
      delta = (viewportWidth - margin) - rect.right;
    }
    if (rect.left + delta < margin) {
      delta = margin - rect.left;
    }
    if (delta !== 0) {
      const currentLeft = parseFloat(getComputedStyle(tip).left) || 0;
      tip.style.left = `${currentLeft + delta}px`;
    }
  }

  document.addEventListener("pointerdown", (e) => {
    if (!e.target?.closest?.(".vapor-pill-wrap")) {
      closeAllTooltips(null);
    }
  });

  window.addEventListener("resize", () => {
    document.querySelectorAll(".vapor-pill-wrap.is-open").forEach(positionTooltip);
  });

  function isConfigured(cfg) {
    return Boolean(cfg && cfg.cpu?.id && cfg.gpu?.id && Number(cfg.ramGb) > 0);
  }

  function clearInjectedUI() {
    document.querySelectorAll("[data-vapor-ui]").forEach((el) => el.remove());
  }

  function formatPct(pct) {
    if (typeof pct !== "number" || Number.isNaN(pct)) {
      return "N/A";
    }
    return pct > 0 ? `+${pct}%` : `${pct}%`;
  }

  function createActionBadge(symbol, modifierClass, tooltipText) {
    const wrap = document.createElement("span");
    wrap.className = "vapor-pill-wrap";
    wrap.setAttribute("data-vapor-ui", "1");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `vapor-badge ${modifierClass}`;
    btn.textContent = symbol;
    btn.setAttribute("aria-label", tooltipText);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isCoarsePointer() && !wrap.classList.contains("is-open")) {
        closeAllTooltips(wrap);
        wrap.classList.add("is-open");
        positionTooltip(wrap);
        return;
      }
      closeAllTooltips(null);
      browser.runtime.sendMessage({ action: "vapor:openOptions" });
    });

    const tip = document.createElement("div");
    tip.className = "vapor-tooltip";
    tip.setAttribute("role", "tooltip");
    const tipLine = document.createElement("div");
    tipLine.className = "vapor-tooltip-line";
    tipLine.textContent = tooltipText;
    tip.appendChild(tipLine);

    const openSettingsBtn = document.createElement("button");
    openSettingsBtn.type = "button";
    openSettingsBtn.className = "vapor-tooltip-btn";
    openSettingsBtn.textContent = "Open Settings";
    openSettingsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAllTooltips(null);
      browser.runtime.sendMessage({ action: "vapor:openOptions" });
    });
    tip.appendChild(openSettingsBtn);

    wrap.addEventListener("mouseenter", () => positionTooltip(wrap));
    wrap.addEventListener("focusin", () => positionTooltip(wrap));

    wrap.appendChild(btn);
    wrap.appendChild(tip);
    return wrap;
  }

  function addTooltipRow(container, label, value, extraClass) {
    const row = document.createElement("div");
    row.className = extraClass ? `vapor-tooltip-row ${extraClass}` : "vapor-tooltip-row";

    const k = document.createElement("span");
    k.className = "vapor-tooltip-key";
    k.textContent = label;

    const v = document.createElement("span");
    v.className = "vapor-tooltip-val";
    v.textContent = value;

    row.appendChild(k);
    row.appendChild(v);
    container.appendChild(row);
  }

  function createSummaryPill(result) {
    const summary = result?.summary || { status: "unavailable" };
    const wrap = document.createElement("span");
    wrap.className = "vapor-pill-wrap";
    wrap.setAttribute("data-vapor-ui", "1");

    const pill = document.createElement("span");
    pill.tabIndex = 0;
    pill.className = "vapor-pill";

    let labelText = "N/A";
    switch (summary.status) {
      case "pass":
        pill.classList.add("vapor-pill--pass");
        labelText = formatPct(summary.overall_pct);
        break;
      case "pass_ram_warning":
        pill.classList.add("vapor-pill--pass", "vapor-pill--ram-warning");
        labelText = `\u26A0 ${formatPct(summary.overall_pct)}`;
        break;
      case "fail":
        pill.classList.add("vapor-pill--fail");
        labelText = formatPct(summary.overall_pct);
        break;
      case "fail_ram_warning":
        pill.classList.add("vapor-pill--fail", "vapor-pill--ram-warning");
        labelText = `\u26A0 ${formatPct(summary.overall_pct)}`;
        break;
      default:
        pill.classList.add("vapor-pill--unavailable");
        labelText = summary.ram_warning ? "\u26A0 N/A" : "N/A";
        break;
    }
    pill.textContent = labelText;
    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !wrap.classList.contains("is-open");
      closeAllTooltips(wrap);
      wrap.classList.toggle("is-open", willOpen);
      if (willOpen) {
        positionTooltip(wrap);
      }
    });
    wrap.addEventListener("mouseenter", () => positionTooltip(wrap));
    wrap.addEventListener("focusin", () => positionTooltip(wrap));

    const tip = document.createElement("div");
    tip.className = "vapor-tooltip";
    tip.setAttribute("role", "tooltip");

    const title = document.createElement("div");
    title.className = "vapor-tooltip-title";
    title.textContent = summary.partial
      ? `Partial Score (${summary.missing_components?.join(", ")} unmatched)`
      : "Overall Score (70% GPU / 30% CPU)";
    tip.appendChild(title);

    if (result?.cpu?.status === "matched") {
      const cpuDetail = result.cpu.method === "blended_70s_30m"
        ? `${formatPct(result.cpu.pct)} (70% 1T ${formatPct(result.cpu.single_pct)} / 30% nT ${formatPct(result.cpu.multi_pct)})`
        : `${formatPct(result.cpu.pct)} (Multi-Core fallback)`;
      const cpuSuffix = result.cpu.match_stage === "series_lowest" ? " (series baseline)" : "";
      addTooltipRow(tip, "CPU", `${cpuDetail} vs ${result.cpu.matched_name}${cpuSuffix}`);
    } else {
      addTooltipRow(tip, "CPU", "Unmatched");
    }

    if (result?.gpu?.status === "matched") {
      const gpuSuffix = result.gpu.match_stage === "series_lowest" ? " (series baseline)" : "";
      addTooltipRow(tip, "GPU", `${formatPct(result.gpu.pct)} vs ${result.gpu.matched_name}${gpuSuffix}`);
    } else {
      addTooltipRow(tip, "GPU", "Unmatched");
    }

    if (result?.ram?.status === "matched") {
      const ramText = `${result.ram.user_gb} GB vs ${result.ram.spec_gb} GB (${formatPct(result.ram.pct)})`;
      addTooltipRow(
        tip,
        "RAM",
        result.ram.sufficient ? ramText : `\u26A0 ${ramText} required`,
        result.ram.sufficient ? "" : "vapor-tooltip-row--warn"
      );
    } else {
      addTooltipRow(tip, "RAM", "Unparsed");
    }

    const alts = [];
    if (result?.cpu?.alternatives_matched?.length > 1) {
      const mode = result.cpu.brand_matched ? "same-brand" : "lowest";
      alts.push(`CPU options (${mode}): ${result.cpu.alternatives_matched.join(" / ")}`);
    }
    if (result?.gpu?.alternatives_matched?.length > 1) {
      const mode = result.gpu.brand_matched ? "same-brand" : "lowest";
      alts.push(`GPU options (${mode}): ${result.gpu.alternatives_matched.join(" / ")}`);
    }
    if (alts.length > 0) {
      const note = document.createElement("div");
      note.className = "vapor-tooltip-note";
      note.textContent = alts.join("; ");
      tip.appendChild(note);
    }

    wrap.appendChild(pill);
    wrap.appendChild(tip);
    return wrap;
  }

  function isPassMarkCompareURL(url) {
    return typeof url === "string" && (
      url.startsWith("https://www.cpubenchmark.net/compare/") ||
      url.startsWith("https://www.videocardbenchmark.net/compare/")
    );
  }

  function createInlinePill(componentResult) {
    if (componentResult && componentResult.status === "matched" && typeof componentResult.pct === "number") {
      const signClass = componentResult.pct >= 0 ? "vapor-pill--pass" : "vapor-pill--fail";
      if (isPassMarkCompareURL(componentResult.passmark_compare_url)) {
        const link = document.createElement("a");
        link.className = `vapor-inline-pill vapor-inline-pill--link ${signClass}`;
        link.setAttribute("data-vapor-ui", "1");
        link.href = componentResult.passmark_compare_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.title = "Compare your hardware vs Minimum & Recommended on PassMark";
        link.textContent = `${formatPct(componentResult.pct)} \u2197`;
        return link;
      }

      const pill = document.createElement("span");
      pill.className = `vapor-inline-pill ${signClass}`;
      pill.setAttribute("data-vapor-ui", "1");
      pill.textContent = formatPct(componentResult.pct);
      return pill;
    }

    const pill = document.createElement("span");
    pill.className = "vapor-inline-pill vapor-pill--unavailable";
    pill.setAttribute("data-vapor-ui", "1");
    pill.textContent = "N/A";
    return pill;
  }

  function renderUnconfigured(tiers) {
    const msg = "Set your CPU, GPU, and RAM in Vapor to compare specs. Click to configure.";
    for (const tier of tiers) {
      if (tier.headingEl) {
        tier.headingEl.insertAdjacentElement("afterend", createActionBadge("?", "vapor-badge--unconfigured", msg));
      }
    }
  }

  function renderError(tiers, apiUrl, resp) {
    const cleanUrl = apiUrl === "https://vapor.nargothrond.pub" ? DEFAULT_API_URL : (apiUrl || DEFAULT_API_URL);
    const msg = resp?.errorType === "http" && resp.message
      ? `Vapor API error: ${resp.message} Click to check settings.`
      : `Vapor API unreachable at ${cleanUrl}. Click to check settings.`;
    for (const tier of tiers) {
      if (tier.headingEl) {
        tier.headingEl.insertAdjacentElement("afterend", createActionBadge("!", "vapor-badge--error", msg));
      }
    }
  }

  function renderResults(tiers, results) {
    for (const tier of tiers) {
      const res = results?.[tier.key];
      if (!res) {
        continue;
      }
      if (tier.headingEl) {
        tier.headingEl.insertAdjacentElement("afterend", createSummaryPill(res));
      }
      if (tier.elements.cpu) {
        tier.elements.cpu.appendChild(createInlinePill(res.cpu));
      }
      if (tier.elements.gpu) {
        tier.elements.gpu.appendChild(createInlinePill(res.gpu));
      }
      if (tier.elements.ram) {
        tier.elements.ram.appendChild(createInlinePill(res.ram));
      }
    }
  }

  async function evaluatePage() {
    const currentRun = ++runSeq;
    clearInjectedUI();
    const tiers = DOM.extractSystemRequirements(document);
    if (tiers.length === 0) {
      return;
    }

    const stored = await browser.storage.sync.get("vaporConfig");
    if (currentRun !== runSeq) {
      return;
    }

    clearInjectedUI();
    const cfg = stored?.vaporConfig;
    if (!isConfigured(cfg)) {
      renderUnconfigured(tiers);
      return;
    }

    const payload = {
      app_id: DOM.extractAppId(location.pathname),
      page_lang: DOM.extractPageLang(document),
      user: {
        cpu_id: cfg.cpu.id,
        cpu_name: cfg.cpu.name || "",
        gpu_id: cfg.gpu.id,
        gpu_name: cfg.gpu.name || "",
        ram_gb: Number(cfg.ramGb)
      },
      tiers: tiers.slice(0, 12).map((t) => ({
        key: t.key,
        os: t.os,
        tier: t.tier,
        cpu: t.cpu,
        gpu: t.gpu,
        ram: t.ram
      }))
    };

    let resp;
    try {
      resp = await browser.runtime.sendMessage({
        action: "vapor:compare",
        payload
      });
    } catch (err) {
      resp = {
        ok: false,
        errorType: "network",
        message: err?.message || "Extension messaging error"
      };
    }
    if (currentRun !== runSeq) {
      return;
    }

    clearInjectedUI();
    if (!resp || !resp.ok || !resp.data?.results) {
      renderError(tiers, cfg.apiUrl || DEFAULT_API_URL, resp);
      return;
    }
    renderResults(tiers, resp.data.results);
  }

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes.vaporConfig) {
      evaluatePage();
    }
  });

  evaluatePage();
})();
