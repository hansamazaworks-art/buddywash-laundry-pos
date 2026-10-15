# Buddy Wash — Laundry Shop Management System

A complete point-of-sale and operations system for a self-service laundry shop, packaged as an **Electron desktop app with a built-in LAN server**. One PC runs the app; every cashier phone, tablet or PC on the shop Wi-Fi opens it in a browser and shares the same live data.

Built as a single-file web app (vanilla HTML/CSS/JS, no framework) plus a zero-dependency Node.js storage server.

## Features

**Point of sale**
- Job orders priced by weight (per machine load), Wash & Dry or Wash Only, Double Wash
- Per-load detergent and fabcon selection (e.g. Load 1 = Surf, Load 2 = Generic) with automatic per-type charges
- Extra scoops and extra drying, split Cash / GCash payments
- Thermal receipt printing (58 mm) and optional cash-drawer trigger
- Admin and cashier PIN roles

**Inventory**
- Automatic stock deduction from orders (detergent, fabcon, bags, LPG) with configurable per-wash / per-extra rules
- Restocks, manual usage, withdrawals, stock corrections, low-stock thresholds
- Inventory report: stock health, reorder suggestions, days-left forecast, usage by item and by day

**Machines**
- Machine card balances and reload tracking
- Preventive maintenance (PMS) counters for washers and dryers, visible to cashiers

**Reports**
- Formal printable **Statement of Sales**: revenue by category, collections, daily schedule, weekday analysis, cashier and customer performance, add-on sales, supplies used, inventory position, with period-over-period comparison
- Expenses, electricity (kWh × rate auto-cost), net income, shifts
- Backup and restore, audit log

**LAN server**
- Electron main process starts a small HTTP server (port 3000) that serves the app and a key-value storage API
- Atomic JSON writes, previous-save `.bak`, and a rolling 30-day daily backup
- No menu bar, tray icon with LAN address, keyboard shortcuts for kiosk-style use

## Architecture

```
Electron (main.js)
 ├─ server.js        zero-dependency HTTP server
 │    ├─ /            static files from public/
 │    └─ /api/storage/{get,set,delete,list}   JSON key-value store -> data.json
 └─ BrowserWindow    loads http://localhost:3000
public/index.html    the whole app (storage layer syncs to the server, with a local fallback)
```

Other devices on the LAN open `http://<server-pc-ip>:3000` and use the same data.

## Getting started

Requires [Node.js](https://nodejs.org) LTS.

```bash
npm install
npm start            # Electron app + LAN server
npm run server       # server only, no Electron window
npm run dist         # build a Windows installer + portable .exe into dist/
```

On Windows, run `allow-firewall.bat` once as Administrator so other devices can connect. The LAN address is shown on first launch, via **Ctrl+L**, and in the tray menu.

Data is stored in `%APPDATA%/Buddy Wash/data/` (`data.json`, `data.json.bak`, `backups/`).

> **Default admin PIN is `1234`.** Change it in Settings after first launch.

## Tech stack

HTML, CSS, vanilla JavaScript · Node.js `http` · Electron · electron-builder

## License

MIT — see [LICENSE](LICENSE).
