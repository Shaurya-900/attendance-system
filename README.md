# E-Cell Attendance

Proxy-proof attendance for E-Cell meetings with a 3-strike rule. Mobile-first web app (Next.js + Supabase, deploys to Vercel).

## How check-in works

1. **Once:** the member signs in with their college Google account (must be on the roster) and registers **their own phone** as a passkey (fingerprint / face / screen lock).
2. **At each meeting:** an admin starts check-in and puts the **projector view** on screen. It shows a QR code that changes every 10 seconds.
3. The member scans it with their phone and confirms with their fingerprint. Done in about 5 seconds.

## Why proxies don't work

| Attempt | What stops it |
|---|---|
| Sending a photo of the QR / the link to someone absent | The token is signed and dies after 10–20 s; the check-in challenge then expires in 60 s |
| Giving your login to a friend | Check-in needs a passkey that only exists on your registered phone, unlocked with your biometrics |
| One phone checking in several people | Each phone gets a device ID; one device can check in one member per meeting. A second attempt is refused and logged |
| Registering a friend's account on your phone | One passkey per member; a phone already registered to someone else is refused. Changing phones needs an admin reset (logged) |
| Clearing browser data to dodge the device check | The check-in is flagged `new device` / `device mismatch` for admins to review |
| Strangers signing up | Only roster emails on `ALLOWED_EMAIL_DOMAIN` can sign in |

**Known gap:** someone in the room could live-stream the QR to a person outside, who has ~20 s to scan it. Cheap add-ons if this happens: random roll-call audits, a geofence flag, or a check-out code at the end.

## 3-strike rule

- Unexcused absence = **1** point. Late check-ins are recorded but **not penalised**. Approved excuse = **0**.
- **2** points → warning to the member; **3** → flagged on the admin dashboard for review (admins decide whether to deactivate).
- Points reset each semester (admins set semester dates). Admins can adjust points with a reason. Overrides, resets and proxy attempts go to an audit log.
- Members can request an excuse up to 24 h after a meeting starts.

Closing a meeting marks every active member who didn't check in as absent (or excused if their excuse was approved).

## Groups (teams, leads, event teams)

Besides full-body meetings, admins can create as many **groups** as needed under **Admin → Groups**: teams (Marketing, Tech, Design, …), the core team, a leads group (sub-core), or temporary event teams with an end date.

- A meeting can be for **Full body** or for one group. Only that group's members are expected, can check in, or get marked absent.
- **Each group keeps its own 3-strike count**, separate from full body. A member sees one card per count on *My attendance*.
- Admins can make any group member a **lead**. Leads can create, run and close their group's meetings, add or remove members, review excuses for their meetings and export them. They can't touch full-body meetings or other groups.
- Event teams stop appearing in the "new meeting" list after their end date, and admins can archive any group. History and strikes are kept.
- People must have signed in to the app once before they can be added to a group.

## Setup

1. Create a [Supabase](https://supabase.com) project. In the SQL editor, run each file in `supabase/migrations/` in order (`0001`, `0002`, `0003`, …).
2. In Supabase → Authentication → Providers, enable **Google** (create OAuth credentials in Google Cloud; add `https://<your-project>.supabase.co/auth/v1/callback` as a redirect URI). Add your site URL and `https://<your-site>/api/auth/callback` to Supabase's allowed redirect URLs.
3. Add yourself as the first admin:
   ```sql
   insert into roster (email, name, roll_no, role) values ('you@yourcollege.edu', 'Your Name', 'XYZ', 'admin');
   ```
   Then import the other members from **Admin → Members** (`email,name,roll_no` per line).
4. Copy `.env.example` to `.env.local` and fill it in. `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` must match the deployed domain exactly (passkeys are bound to it, so don't change domains later without resetting passkeys).
5. Deploy to Vercel with the same environment variables. Passkeys need HTTPS (Vercel provides it).

## Local development

```bash
npm install
npm run dev:memory   # demo mode: in-memory data, pick a user on /login, no Supabase needed
npm test             # unit tests (QR tokens, strike maths, meeting close, sealed cookies)
npm run test:e2e     # Playwright: passkey registration + check-in with a virtual fingerprint authenticator
npm run lint && npm run typecheck && npm run build
```

Demo mode (`DATA_BACKEND=memory`) has a fake sign-in and loses data on restart. Never use it in production.

## Code map

- `src/lib/qr-token.ts`: rotating HMAC token for the projected QR
- `src/lib/webauthn.ts`, `src/lib/device.ts`: passkey registration/verification, device binding
- `src/lib/strikes.ts`, `src/lib/meetings.ts`: strike rules, semester handling, closing meetings
- `src/lib/repo/`: data access (`supabase.ts` for production, `memory.ts` for demo/tests)
- `src/app/api/checkin/*`: check-in: validate QR → issue passkey challenge → verify → record
- `src/app/admin/*`: dashboard, meetings + projector view, members, excuses
