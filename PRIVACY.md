# Vapor — Privacy Policy

**Vapor** is designed to compare your PC hardware against Steam store system requirements without user accounts, tracking cookies, or analytics.

## Data Sent to the API

When you search for hardware in settings or visit a Steam store page (`https://store.steampowered.com/app/*`), the extension sends the following data to the configured Vapor API (default: `https://vapor.nargothrond.pub`):

- **Hardware Search:** The CPU or GPU search query string you type.
- **Steam Spec Comparison:** Your selected CPU ID, GPU ID, RAM amount (in GB), and the public system requirement text extracted from the Steam store page.

## Data Storage & Logging

- **Browser Storage:** Your selected CPU, GPU, RAM, and custom API URL are stored locally in Firefox via `browser.storage.sync`.
- **Server Logs:** The Vapor API logs only the Steam app ID and parsed Steam requirement strings (`spec_parsed`) for parser quality monitoring. It does **not** store client IP addresses, user-agents, or your personal hardware selection in comparison logs.
- **No Third-Party Tracking:** Vapor contains no analytics SDKs, advertising trackers, or external font/CDN requests.
