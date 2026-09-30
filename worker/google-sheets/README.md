# Google Sheets entry receiver

This endpoint appends Control Panel submissions to a dedicated spreadsheet. It
does not write to the public DoR source spreadsheet.

1. Create or choose a MEROSADAK-owned Google spreadsheet.
2. In **Extensions → Apps Script**, replace the editor contents with `Code.gs`.
3. In **Project Settings → Script Properties**, set:
   - `SPREADSHEET_ID`: the ID between `/d/` and `/edit` in the sheet URL.
   - `SHEET_NAME`: optional; defaults to `MEROSADAK Entries`.
   - `WRITE_TOKEN`: a new, high-entropy random secret (at least 32 random bytes).
4. Deploy the script as a **Web app**, executing as you, accessible to anyone.
   The deployed URL is the `/exec` URL. The shared token is the authorization
   boundary; never put it in frontend code or commit it to the repository.
5. From the repository root, set the same receiver URL and token as Worker
   secrets:

   ```powershell
   Set-Location worker
   npx wrangler secret put GOOGLE_SHEETS_WEB_APP_URL
   npx wrangler secret put GOOGLE_SHEETS_WRITE_TOKEN
   npx wrangler deploy
   ```

   Wrangler prompts for each secret value. Use the deployed `/exec` URL and the
   exact same `WRITE_TOKEN` value stored in Apps Script.
6. Redeploy Firebase Hosting after the Worker is configured. OfficeAdmin and
   SuperAdmin can then submit entries from the Control Panel.

The receiver creates the configured tab and header row if needed. It stores
submission time, signed-in account, role, highway code/name, district, location,
status, and remarks. Sheet values are written as text-safe strings to avoid
formula injection.

Account analytics are separate from Sheets: the Worker stores a daily record
using a SHA-256 Firebase account-ID digest and role, expires those records after
60 days, and reports 30-day unique-account and daily active-account counts to
both admin roles. Raw email addresses and Firebase IDs are not included in
analytics records or responses.
