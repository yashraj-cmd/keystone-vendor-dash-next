# Deploying the Keystone Vendor Dashboard (Vercel)

This app is a Next.js 14 app that talks to **Supabase (Postgres)**, **Zoho Books**,
**Google Drive**, and **Gmail** (for login codes + PO emails). The code has **no secrets in
it** — everything sensitive comes from environment variables you set in Vercel.

> ⚠️ **Never commit real secret values to this repo.** Only the *keys* are documented here.
> Copy the actual values from the current deployment / a password manager into Vercel directly.

---

## 1. Import the project into Vercel
1. Vercel → **Add New → Project** → import this GitHub repo.
2. Framework preset: **Next.js** (auto-detected).
3. Build command: `prisma generate && next build` (already in `package.json`).
4. Install command: `pnpm install` (repo uses **pnpm**; a `pnpm-lock.yaml` is committed).

## 2. Set environment variables
Add these under **Settings → Environment Variables**, ticked for **Production** (and Preview if
you want PR previews to work). Values come from the current deployment / password manager.

### Database (Supabase)
| Key | What / where |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler**, port **6543**, ends with `?pgbouncer=true&connection_limit=1` (runtime) |
| `DIRECT_URL` | Supabase **session pooler**, port **5432** (used for migrations only) |

### Auth (JWT)
| Key | What |
|---|---|
| `JWT_ACCESS_SECRET` | long random string (do NOT leave default) |
| `JWT_REFRESH_SECRET` | long random string |
| `JWT_ACCESS_TTL` | e.g. `15m` |
| `JWT_REFRESH_TTL` | e.g. `7d` |

### App
| Key | What |
|---|---|
| `APP_URL` | the production URL (optional — code auto-detects the Vercel URL if unset) |

### Zoho Books
| Key |
|---|
| `ZOHO_ENABLED` (`true`) |
| `ZOHO_CLIENT_ID` |
| `ZOHO_CLIENT_SECRET` |
| `ZOHO_REFRESH_TOKEN` |
| `ZOHO_ORGANIZATION_ID` |
| `ZOHO_DC` (`in`) |
| `ZOHO_INVOICE_SOURCE` (`bills` for procurement, or `invoices`) |

### Google Drive (catalogues)
| Key |
|---|
| `DRIVE_ENABLED` (`true`) |
| `DRIVE_CATALOGUES_FOLDER_ID` |
| `DRIVE_SERVICE_ACCOUNT_JSON` (base64-encoded service-account key) |

### Mail — Gmail OAuth (preferred; used for login codes + PO emails)
| Key |
|---|
| `GMAIL_OAUTH_CLIENT_ID` |
| `GMAIL_OAUTH_CLIENT_SECRET` |
| `GMAIL_OAUTH_REFRESH_TOKEN` (scope: `gmail.send`) |
| `GMAIL_SENDER_EMAIL` |
| `GMAIL_SENDER_NAME` (e.g. `Keystone Procurement`) |
| `PO_APPROVER_EMAIL` (admin who approves POs) |

### Mail — SMTP (optional fallback; used only if the GMAIL_OAUTH_* vars are empty)
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`

## 3. Database migrations
The database is **shared/external (Supabase)** and its tables already exist. If the schema
changes in a future PR, apply it once from a machine with the secrets:
```bash
DIRECT_URL="<5432 session-pooler URL>" npx prisma db push
```
(Vercel builds only run `prisma generate`, which does not touch the DB.)

## 4. Deployment protection
Vercel → **Settings → Deployment Protection** → set **Vercel Authentication → Disabled** so the
team can reach the app (it has its own email-code login).

## 5. Verify after deploy
- Open the production URL → login screen loads.
- Request a login code for a provisioned email → code arrives (check Vercel **Logs** for
  `[mail] sent via gmail-api …`).
- Log in as an admin → the **Team** button (top-right) lists members.

---

## How the app works (quick map)
- **Login:** passwordless — a 6-digit code emailed to provisioned users (`login_otps` table).
- **Roles:** Admin (approves POs, manages the Team page), Procurement (vendors/catalogues/POs),
  Viewer (read-only).
- **Vendors → catalogues → purchase orders → invoices** is the core flow.
- **Invoices** auto-sync from Zoho Books; **approved POs** are created in Zoho automatically.
- **Catalogues** sync from a Google Drive folder (filename starts with the vendor name).
- Money is stored as integer **paise** in the DB.

## Local development
```bash
pnpm install
pnpm dev        # http://localhost:3000
```
Needs a local `.env` (same keys as above). Uses the same Supabase DB unless pointed elsewhere.
