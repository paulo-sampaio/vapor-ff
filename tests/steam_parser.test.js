"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const DOM = require("../scripts/steam_dom.js");

test("normalizeLabel and classifyField handle multilingual Steam labels", () => {
  assert.equal(DOM.normalizeLabel("Processor:"), "processor");
  assert.equal(DOM.normalizeLabel("Memória:"), "memoria");
  assert.equal(DOM.normalizeLabel("Mémoire vive："), "memoire vive");

  assert.equal(DOM.classifyField("Processor:"), "cpu");
  assert.equal(DOM.classifyField("Processador:"), "cpu");
  assert.equal(DOM.classifyField("Prozessor:"), "cpu");
  assert.equal(DOM.classifyField("プロセッサ:"), "cpu");

  assert.equal(DOM.classifyField("Graphics:"), "gpu");
  assert.equal(DOM.classifyField("Placa de vídeo:"), "gpu");
  assert.equal(DOM.classifyField("Carte graphique :"), "gpu");
  assert.equal(DOM.classifyField("Grafikkarte:"), "gpu");

  assert.equal(DOM.classifyField("Memory:"), "ram");
  assert.equal(DOM.classifyField("Arbeitsspeicher:"), "ram");
  assert.equal(DOM.classifyField("Memória RAM:"), "ram");
  assert.equal(DOM.classifyField("Storage:"), null);
});

test("extractAppId parses Steam app URLs", () => {
  assert.equal(DOM.extractAppId("/app/1091500/Cyberpunk_2077/"), "1091500");
  assert.equal(DOM.extractAppId("/app/730"), "730");
  assert.equal(DOM.extractAppId("/search/"), "");
});

function makeLi(label, value) {
  const strong = { textContent: label };
  return {
    textContent: `${label} ${value}`,
    querySelector(sel) {
      return sel === "strong" ? strong : null;
    }
  };
}

function makeBlock(headingText, lis) {
  const heading = { textContent: headingText };
  return {
    querySelector(sel) {
      return sel.includes("strong") ? heading : null;
    },
    querySelectorAll(sel) {
      return sel === "li" ? lis : [];
    }
  };
}

test("extractSystemRequirements extracts multiple OS tabs and tiers", () => {
  const winBlock = {
    getAttribute(attr) {
      return attr === "data-os" ? "win" : null;
    },
    querySelector(sel) {
      if (sel === ".game_area_sys_req_leftCol") {
        return makeBlock("Minimum:", [
          makeLi("Processor:", "Intel Core i7-6700 or AMD Ryzen 5 1600"),
          makeLi("Memory:", "12 GB RAM"),
          makeLi("Graphics:", "GeForce GTX 1060 6GB")
        ]);
      }
      if (sel === ".game_area_sys_req_rightCol") {
        return makeBlock("Recommended:", [
          makeLi("Processor:", "Intel Core i7-12700"),
          makeLi("Memory:", "16 GB RAM"),
          makeLi("Graphics:", "GeForce RTX 2060 SUPER")
        ]);
      }
      return null;
    }
  };

  const linuxBlock = {
    getAttribute(attr) {
      return attr === "data-os" ? "linux" : null;
    },
    querySelector(sel) {
      if (sel === ".game_area_sys_req_full") {
        return makeBlock("Minimum:", [
          makeLi("Processor:", "AMD Ryzen 5 3600"),
          makeLi("Memory:", "8 GB RAM")
        ]);
      }
      return null;
    }
  };

  const mockDoc = {
    documentElement: {
      getAttribute(attr) {
        return attr === "lang" ? "pt-BR" : null;
      }
    },
    querySelectorAll(sel) {
      if (sel === ".game_area_sys_req[data-os]") {
        return [winBlock, linuxBlock];
      }
      return [];
    }
  };

  assert.equal(DOM.extractPageLang(mockDoc), "pt-br");

  const tiers = DOM.extractSystemRequirements(mockDoc);
  assert.equal(tiers.length, 3);
  assert.equal(tiers[0].key, "win:minimum");
  assert.equal(tiers[0].cpu, "Intel Core i7-6700 or AMD Ryzen 5 1600");
  assert.equal(tiers[0].gpu, "GeForce GTX 1060 6GB");
  assert.equal(tiers[0].ram, "12 GB RAM");

  assert.equal(tiers[1].key, "win:recommended");
  assert.equal(tiers[2].key, "linux:minimum");
  assert.equal(tiers[2].gpu, "");
});

test("extractSystemRequirements ignores li > strong when no tier heading exists", () => {
  const osLabelStrong = {
    textContent: "OS:",
    closest(sel) {
      return sel === "li" ? {} : null;
    }
  };
  const osLi = {
    textContent: "OS: Windows 10",
    querySelector(sel) {
      return sel === "strong" ? osLabelStrong : null;
    }
  };
  const cpuLi = makeLi("Processor:", "AMD Ryzen 5 3600");

  const blockNoHeading = {
    querySelector(sel) {
      if (sel === "strong") {
        return osLabelStrong;
      }
      return null;
    },
    querySelectorAll(sel) {
      return sel === "li" ? [osLi, cpuLi] : [];
    }
  };

  const mockDoc = {
    querySelectorAll(sel) {
      if (sel === ".game_area_sys_req[data-os]") {
        return [{
          getAttribute() {
            return "win";
          },
          querySelector(q) {
            return q === ".game_area_sys_req_leftCol" ? blockNoHeading : null;
          }
        }];
      }
      return [];
    }
  };

  const tiers = DOM.extractSystemRequirements(mockDoc);
  assert.equal(tiers.length, 1);
  assert.equal(tiers[0].headingEl, null);
  assert.equal(tiers[0].cpu, "AMD Ryzen 5 3600");
});
