# THAKOS setup and operational notes

## 1. Requirements
- Node.js 20 LTS or newer
- npm
- Chrome, Edge, or another modern browser

## 2. Install and run
```bash
npm install
npm run dev
```

## 3. First launch
- Create a four-digit PIN.
- Open Settings and set the correct opening/start balance before entering the first business day.
- Enter each receipt as Credit and each payment as Debit.
- Use particulars such as `CM_Rahim` to have the entry categorized in the Commission Book.
- Close the day after checking the figures.
- The next date's diary will carry forward the previous diary closing balance when that diary is created.

## 4. Backup
Open Settings → Download full backup. Store the JSON file somewhere safe. To restore, use Restore from backup.

Do not clear browser site data without a backup. Local data is stored in the browser profile on that device.

## 5. Multi-device setup — important
The current delivered build is local-first and **does not yet implement cloud upload/download or conflict resolution**. The Supabase client package and optional environment variables are included as a foundation only. Multi-device sync must be implemented and tested before using the same account on a phone and laptop.

Recommended production sync design:
- Supabase Auth with a dedicated user account.
- Tables for `daily_diaries` and `transactions`, each scoped to `auth.uid()`.
- RLS policies for SELECT/INSERT/UPDATE/DELETE using `auth.uid() = user_id`.
- Store transaction IDs as UUIDs generated on device.
- Keep a local IndexedDB outbox for offline changes.
- Push queued mutations idempotently using transaction UUIDs.
- Pull remote updates using `updated_at` cursors.
- Use a defined conflict rule (prefer explicit conflict resolution for edits; do not silently overwrite).
- Never store Supabase service-role keys in the browser. Only the anon/publishable key belongs in Vite frontend environment variables.
- Add a sync status indicator that reflects actual sync state, not merely the presence of credentials.

Do not enter real company records on multiple devices until synchronization has been tested end-to-end.

## 6. PIN and security
The PIN is hashed with Web Crypto and stored locally. It is not a cloud account login and does not encrypt the local financial data. Protect the device user account and browser profile. A production deployment should add authenticated cloud access, server-side RLS, secure recovery and appropriate data encryption.

## 7. Accounting behavior
- Credit increases the running balance.
- Debit decreases the running balance.
- Closing balance = opening balance + credits - debits.
- `CM_` particulars are categorized as commission and remain a single original transaction.
- Editing or deleting a transaction recalculates the diary totals and commission summary.
- Closed diaries must be reopened before editing/deleting.

## 8. Current known scope limitations
- Forty rows are shown in the daily notebook; extra entries are still stored, but a multi-sheet pagination UI is not implemented.
- Cloud synchronization is not implemented in this delivered build.
- The local PIN lock does not encrypt data at rest.
- The service worker caches the app shell and uses a basic offline fallback; full offline asset/data synchronization should be tested after deployment.
