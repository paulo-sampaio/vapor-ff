# Vapor Firefox Extension

Zero-dependency vanilla JS/HTML/CSS Firefox Manifest V3 extension (`strict_min_version: "142.0"`) for comparing your CPU, GPU, and RAM against Steam store page system requirements.

## Load Temporary Add-on in Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** and select `manifest.json` from this directory (`extension-ff/`).
3. Vapor opens the configuration tab automatically; search and select your CPU, GPU, and RAM, then click **Save Configuration**.
4. Open **Advanced** in settings if you need to configure a custom API URL (defaults to `https://vapor.nargothrond.pub`).
5. Open any Steam store page (`https://store.steampowered.com/app/*`) to see comparison pills, tooltips, and PassMark comparison links.

## Tests, Linting & AMO Packaging

Run all commands from this directory (`extension-ff/`):

```bash
node --test tests/*.test.js
python3 -c 'import json; m=json.load(open("manifest.json")); assert m["manifest_version"]==3; assert m["browser_specific_settings"]["gecko"]["data_collection_permissions"]["required"]==["websiteContent"]; assert "https://vapor.nargothrond.pub/*" in m["host_permissions"]'
! grep -rnE "innerHTML|outerHTML|insertAdjacentHTML|eval\(" . --exclude-dir=.git --exclude-dir=.github --exclude-dir=.agents --exclude='*.md'

# Lint & build uploadable zip for addons.mozilla.org (AMO)
npx web-ext lint -s . --ignore-files ".git/**" ".github/**" ".agents/**" "tests/**" "*.md"
npx web-ext build -s . --ignore-files ".git/**" ".github/**" ".agents/**" "tests/**" "*.md"
```

See [PRIVACY.md](file:///home/pneto/trabalho/nargothrond-pub/projetos/vapor/extension-ff/PRIVACY.md) for the AMO privacy policy text.
