# THAKOS — Digital Account Diary

A responsive React/Vite application for daily company accounts.

## Included
- Four-digit local PIN gate
- Daily credit/debit diary with 40 visible rows
- Opening, credit, debit, running and closing balance calculations
- Automatic `CM_Name` commission grouping
- Dashboard, cash-flow chart and attention status
- Diary archive and transaction search
- Daily PDF, daily PNG and monthly PDF exports
- Calculator
- JSON backup and restore
- PWA manifest and service worker
- Optional Supabase client scaffold

## Important data and sync note
The current release stores data in this browser's local storage. It is usable on one browser/device and can export/import JSON backups. **It does not yet synchronize records between devices**, even if Supabase environment variables are supplied. Do not assume mobile and desktop share data. Follow `SETUP.md` for the cloud-sync implementation requirements before using this for multi-device production accounting.

The local PIN is a convenience lock, not full database encryption. Browser storage can be lost if site data is cleared. Export backups regularly.

## Run locally
1. Install Node.js LTS.
2. Extract this ZIP.
3. Open a terminal in this folder.
4. Run `npm install`.
5. Copy `.env.example` to `.env` if you plan to configure Supabase later.
6. Run `npm run dev`.
7. Open the URL printed by Vite (usually http://localhost:5173).

## Production build
Run `npm run build`. Deploy the `dist` folder to a static hosting provider with SPA fallback enabled.

## Currency
Default display currency is INR (₹).
