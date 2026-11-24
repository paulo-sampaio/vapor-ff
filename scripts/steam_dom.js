(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.VaporSteamDOM = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CPU_LABELS = new Set([
    "processor",
    "cpu",
    "processador",
    "procesador",
    "prozessoren",
    "prozessor",
    "processeur",
    "processore",
    "procesor",
    "процессор",
    "プロセッサ",
    "处理器",
    "處理器",
    "프로세서",
    "islemci"
  ]);

  const GPU_LABELS = new Set([
    "graphics",
    "video card",
    "gpu",
    "placa de video",
    "placa grafica",
    "graficos",
    "tarjeta grafica",
    "grafik",
    "grafikkarte",
    "carte graphique",
    "graphiques",
    "scheda video",
    "grafica",
    "karta graficzna",
    "видеокарта",
    "グラフィック",
    "显卡",
    "顯示卡",
    "그래픽",
    "ekran karti"
  ]);

  const RAM_LABELS = new Set([
    "memory",
    "ram",
    "memoria",
    "memoria ram",
    "arbeitsspeicher",
    "memoire",
    "memoire vive",
    "pamiec",
    "оперативная память",
    "メモリー",
    "メモリ",
    "内存",
    "記憶體",
    "메모리",
    "bellek"
  ]);

  function normalizeLabel(raw) {
    if (typeof raw !== "string") {
      return "";
    }
    return raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .normalize("NFC")
      .toLowerCase()
      .replace(/[:：\s]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function classifyField(rawLabel) {
    const norm = normalizeLabel(rawLabel);
    if (!norm) {
      return null;
    }
    if (CPU_LABELS.has(norm)) {
      return "cpu";
    }
    if (GPU_LABELS.has(norm)) {
      return "gpu";
    }
    if (RAM_LABELS.has(norm)) {
      return "ram";
    }
    return null;
  }

  function extractAppId(pathname) {
    if (typeof pathname !== "string") {
      return "";
    }
    const m = pathname.match(/\/app\/(\d+)/);
    return m ? m[1] : "";
  }

  function extractPageLang(doc) {
    const lang = doc?.documentElement?.getAttribute?.("lang") || "";
    return lang.trim().toLowerCase() || "en";
  }

  function extractSpecText(liEl, labelText) {
    const full = (liEl?.textContent || "").replace(/\s+/g, " ").trim();
    if (!full) {
      return "";
    }
    const cleanLabel = (labelText || "").replace(/\s+/g, " ").trim();
    if (cleanLabel && full.toLowerCase().startsWith(cleanLabel.toLowerCase())) {
      return full.slice(cleanLabel.length).replace(/^[:：\s]+/, "").trim();
    }
    const colonIdx = full.search(/[:：]/);
    if (colonIdx !== -1 && colonIdx < 32) {
      return full.slice(colonIdx + 1).trim();
    }
    return full;
  }

  function findTierHeading(blockEl) {
    if (!blockEl || typeof blockEl.querySelector !== "function") {
      return null;
    }
    const strongDirect = blockEl.querySelector("ul > strong, p > strong, h2, h3, strong");
    return strongDirect || null;
  }

  function parseTierBlock(blockEl, os, tier) {
    if (!blockEl || typeof blockEl.querySelectorAll !== "function") {
      return null;
    }
    const headingEl = findTierHeading(blockEl);
    const items = blockEl.querySelectorAll("li");
    if (!items || items.length === 0) {
      return null;
    }

    const entry = {
      key: `${os}:${tier}`,
      os,
      tier,
      headingEl,
      cpu: "",
      gpu: "",
      ram: "",
      elements: {
        cpu: null,
        gpu: null,
        ram: null
      }
    };

    for (const li of items) {
      const strong = typeof li.querySelector === "function" ? li.querySelector("strong") : null;
      const rawLabel = strong ? strong.textContent : "";
      const field = classifyField(rawLabel);
      if (!field) {
        continue;
      }
      const value = extractSpecText(li, rawLabel);
      if (!value) {
        continue;
      }
      if (!entry[field]) {
        entry[field] = value;
        entry.elements[field] = li;
      }
    }

    if (!entry.cpu && !entry.gpu && !entry.ram && !headingEl) {
      return null;
    }
    return entry;
  }

  function extractSystemRequirements(doc) {
    if (!doc || typeof doc.querySelectorAll !== "function") {
      return [];
    }

    let containers = Array.from(doc.querySelectorAll(".game_area_sys_req[data-os]"));
    if (containers.length === 0) {
      containers = Array.from(doc.querySelectorAll(".game_area_sys_req"));
    }

    const tiers = [];
    for (const container of containers) {
      const os = (container.getAttribute?.("data-os") || "default").trim().toLowerCase() || "default";
      const leftCol = container.querySelector?.(".game_area_sys_req_leftCol") || container.querySelector?.(".game_area_sys_req_full");
      const rightCol = container.querySelector?.(".game_area_sys_req_rightCol");

      if (leftCol) {
        const minTier = parseTierBlock(leftCol, os, "minimum");
        if (minTier) {
          tiers.push(minTier);
        }
      }
      if (rightCol) {
        const recTier = parseTierBlock(rightCol, os, "recommended");
        if (recTier) {
          tiers.push(recTier);
        }
      }
    }
    return tiers;
  }

  return {
    normalizeLabel,
    classifyField,
    extractAppId,
    extractPageLang,
    extractSpecText,
    extractSystemRequirements
  };
});
