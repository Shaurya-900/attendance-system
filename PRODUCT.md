# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Members** (100–300 students in the E-Cell, the Entrepreneurship Cell at Shiv Nadar University, SNU). They use their phones at the start of a meeting: scan the QR on the projector, confirm with a fingerprint, done in about 5 seconds. Between meetings they check their strike count and request excuses.
- **Team leads** run most meetings day to day: they create and start their own group's meetings, put the projector view up, add or remove members, review excuses and export attendance.
- **Core admins** step in rarely: full-body meetings, groups, the member roster, semesters, strike adjustments and the flagged-member review.

## Product Purpose

Proxy-proof attendance for E-Cell meetings with a 3-strike rule. It replaces paper sign-in sheets and roll calls that friends could sign for each other. Success means a meeting's attendance is taken in seconds, nobody can mark an absent friend present, and members always know where they stand.

## Positioning

Check-in is bound to the member's own phone (passkey plus biometrics) and to a QR code that changes every 10 seconds, so sharing a photo, a link or a login doesn't work. Strikes are counted per group and per semester, separate from full-body meetings.

## Operating Context

- Meetings happen in a room with a projector: a lead opens the projector view, which shows the rotating QR; members scan it from their seats.
- One-time onboarding: sign in with the college Google account (`@snu.edu.in`, must be on the roster), then register the phone as a passkey.
- Roster is imported as CSV lines `email,name,roll_no[,admin]`. SNU roll numbers are 11 digits starting with 2 (e.g. `24010110104`).
- Groups: teams (Marketing, Tech, Design, …), core, leads, and event teams with an end date. Each keeps its own 3-strike count.
- Semesters are set by admins; points reset each semester.

## Capabilities and Constraints

- Unexcused absence = 1 point; late check-ins are recorded but not penalised; approved excuse = 0. 2 points → warning, 3 → flagged for admin review (admins decide on deactivation).
- Members can request an excuse up to 24 h after a meeting starts. Closing a meeting marks non-checked-in members absent (or excused).
- One passkey per member; one device checks in one member per meeting. Phone changes need an admin reset. Suspicious check-ins are flagged (`new device`, `device mismatch`) and audit-logged.
- Known gap: someone in the room could live-stream the QR to a person outside (~20 s window).
- Mobile-first; members use it almost entirely on phones. Admin and lead screens must also work on phones; the projector view is a large screen.
- Stack: Next.js App Router + Supabase, deployed on Vercel. Passkeys are bound to the deployed domain, so the domain must not change without resetting passkeys.

## Brand Commitments

- Name: **E-Cell Attendance**.
- Logo: the E-Cell mark (white arrow-and-"e" on a blue circle), at `src/app/icon.png`.
- Voice: casual and club-like. Attendance is a nudge between peers, not a policing tool. Rules are still stated plainly (e.g. "Three strikes. No proxies.").

## Evidence on Hand

- Demo data only: four seeded users in the in-memory backend. No real member data, usage numbers or testimonials exist in the repo; do not invent any.

## Product Principles

1. Check-in must be faster than a roll call: one scan, one fingerprint.
2. Make proxying impossible rather than punishable.
3. Members should always see their own standing, per group, without asking anyone.
4. Leads run their own meetings without needing a core admin.
5. Every override is visible: adjustments, resets and proxy attempts are logged.
