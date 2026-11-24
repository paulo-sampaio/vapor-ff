# Vapor Firefox Extension (`vapor-ff`)

**Vapor** is a minimalist Firefox Manifest V3 extension (`strict_min_version: "142.0"`) that compares your PC's CPU, GPU, and RAM against `MINIMUM` and `RECOMMENDED` system requirements on Steam store pages (`https://store.steampowered.com/app/*`), rendering percentage pills, breakdown tooltips, and direct 3-way PassMark comparison links.

It pairs with the [Vapor Go + SQLite REST API (`vapor-api`)](https://github.com/paulo-sampaio/vapor-api), defaulting to `https://vapor.nargothrond.pub`.

## Features & User Experience

- **First-Install Onboarding:** Automatically opens the configuration tab on install so you can pick your CPU, GPU, and RAM once (`browser.storage.sync`).
- **Unconfigured & Error Badges:** Shows clickable `?` badges on Steam requirement headings when unconfigured, or `!` badges if the API is unreachable; clicking opens settings.
- **Section Summary Pills:** Displays weighted overall percentage pills (`70% GPU + 30% CPU`) beside each `MINIMUM` and `RECOMMENDED` heading, with amber `⚠` warning flags if your RAM is below spec.
- **Inline Spec Pills & PassMark Links:** Appends individual percentage micro-pills beside `Processor`, `Graphics`, and `Memory` rows. CPU and GPU pills link directly to PassMark's 3-way comparison (`You vs Minimum vs Recommended`) when IDs are available.
- **Accessible Hover/Focus Tooltips:** Shows exact CPU (`70% Single / 30% Multi` or `Multi-Core fallback`), GPU, RAM breakdowns, `(series baseline)` indicators, and `same-brand` vs `lowest` alternative notes.
- **Multilingual & Multi-OS Support:** Extracts requirements across all Steam OS tabs (`win`, `linux`, `mac`) in one batched API call and recognizes labels in 15+ languages (English, Portuguese, Spanish, German, French, Italian, Polish, Russian, Japanese, Chinese, Korean, Turkish).
- **Live Tab Sync & Custom API URL:** Saving settings immediately re-evaluates all open Steam tabs without reloading. An **Advanced** section lets self-hosters point to a custom API URL and test connectivity.

## Architecture, Security & Design

- **Zero Dependencies & Zero Bundler:** Plain vanilla JavaScript, HTML, and CSS targeting Firefox Manifest V3 for transparent Mozilla Add-ons (AMO) review.
- **Strict AMO DOM Security:** Zero `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `eval` anywhere in the codebase. All DOM nodes are built via `document.createElement`, `textContent`, `classList`, and `setAttribute`.
- **Mixed-Content / CSP Proxy:** Content scripts run on HTTPS Steam pages and delegate all API `fetch` calls to `background.js` via `browser.runtime.sendMessage`.
- **Kirimure Salvador Coastal Palette:** Options and popup views share `styles/settings.css` with offline system font fallbacks (zero external CDN requests), while Steam overlays (`styles/steam.css`) harmonize with Steam's dark UI.
- **Privacy:** Declares `websiteContent` in `data_collection_permissions` for transmitting Steam requirement strings to the comparison API. See [PRIVACY.md](./PRIVACY.md) for full details.

## Repository Layout

```text
extension-ff/
├── manifest.json                   # Firefox MV3 manifest (strict_min_version: 142.0)
├── background.js                   # Install auto-open & AbortController API fetch proxy
├── content.js                      # Steam DOM evaluator, badge/pill/tooltip renderer, live sync
├── options.html                    # Full-tab hardware & API settings page
├── popup.html                      # Compact 380px toolbar popup
├── PRIVACY.md                      # AMO privacy policy
├── icons/
│   └── icon.svg                    # Coastal blue & gold SVG icon
├── scripts/
│   ├── settings.js                 # Shared ARIA comboboxes, RAM selector, API URL validator/tester
│   └── steam_dom.js                # Pure DOM & multilingual label extractor (browser + Node test)
├── styles/
│   ├── settings.css                # Kirimure Salvador Coastal Palette & settings layout
│   └── steam.css                   # High-contrast Steam dark-mode pills & tooltips
├── tests/
│   └── steam_parser.test.js        # Zero-dependency Node built-in test suite (node --test)
└── .github/workflows/
    ├── ci.yml                      # Manifest check, node --test, zero innerHTML/eval guard
    └── release-amo.yml             # Tag/manual web-ext lint, zip build, and AMO signing
```

## Local Development & Testing

Prerequisites: Firefox `142+` and Node.js `24+`.

### Load Temporary Add-on in Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** and select `manifest.json` from this directory (`extension-ff/`).
3. To test against a local `vapor-api` instance, open **Advanced** in Vapor settings, set the API URL to `http://localhost:8080`, click **Test Connection**, and **Save Configuration** (Firefox will prompt for the custom origin permission).

### Automated Tests & AMO Packaging

Run all commands from `extension-ff/`:

```bash
# Unit tests for multilingual label normalization & Steam DOM extraction
node --test tests/*.test.js

# Manifest & zero-innerHTML/eval policy checks
python3 -c 'import json; m=json.load(open("manifest.json")); assert m["manifest_version"]==3; assert m["browser_specific_settings"]["gecko"]["data_collection_permissions"]["required"]==["websiteContent"]; assert "https://vapor.nargothrond.pub/*" in m["host_permissions"]'
! grep -rnE "innerHTML|outerHTML|insertAdjacentHTML|eval\(" . --exclude-dir=.git --exclude-dir=.github --exclude-dir=.agents --exclude='*.md'

# Lint & build uploadable zip for addons.mozilla.org (AMO)
npx web-ext lint -s . --ignore-files ".git/**" ".github/**" ".agents/**" "tests/**" "*.md"
npx web-ext build -s . --ignore-files ".git/**" ".github/**" ".agents/**" "tests/**" "*.md"
```

## CI/CD & AMO Releases

- **`.github/workflows/ci.yml`** runs on every PR and push to verify manifest compliance, `node --test`, and the static `innerHTML`/`eval` guard.
- **`.github/workflows/release-amo.yml`** triggers on `v*` tags (or manual dispatch), runs `web-ext lint` and `web-ext build`, uploads the `.zip` artifact, and signs/publishes to AMO when `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` repository secrets are configured.

## Contributing

1. Keep the extension dependency-free (no npm runtime packages, no build step) and strictly free of `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `eval`.
2. When adding support for new Steam store language labels in `scripts/steam_dom.js`, add corresponding test cases in `tests/steam_parser.test.js`.
3. Verify `node --test tests/*.test.js`, the grep guard, and `web-ext lint` pass before opening a PR.
4. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat(...)`, `fix(...)`, `docs`, `ci`, etc.).
