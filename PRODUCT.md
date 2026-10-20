# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Members** (100–300 students in the E-Cell, the Entrepreneurship Cell at Shiv Nadar University, SNU). They use their phones at the start of a meeting: scan the QR on the projector, confirm with a fingerprint, done in about 5 seconds. Between meetings they check their strike count and request excuses.
- **Team leads** (the sub-core: the leads of each team) run most meetings day to day: they create and start their own team's meetings, put the projector view up, add or remove members, review excuses and export attendance.
- **Core admins** step in less often: full-body and core meetings, groups, the member roster, semesters, strike adjustments and the flagged-member review.
- **Approvers**: admins who must accept other admins' edits to member details. Today that is the tech lead (who runs the app) and the current secretary.
- **Advisors**: can sign in but have no attendance requirement.

## Product Purpose

Proxy-proof attendance for E-Cell meetings with a 3-strike rule. It replaces paper sign-in sheets and roll calls that friends could sign for each other. Success means a meeting's attendance is taken in seconds, nobody can mark an absent friend present, and members always know where they stand.

## Positioning

Check-in is bound to the member's own phone (passkey plus biometrics) and to a QR code that changes every 10 seconds, so sharing a photo, a link or a login doesn't work. Strikes are counted per semester, in one shared count across full-body and group meetings.

## Operating Context

- Meetings happen in a room with a projector: a lead opens the projector view, which shows the rotating QR; members scan it from their seats.
- One-time onboarding: sign in with the SNU mail ID (the college Google account, `@snu.edu.in`; must be on the roster), then register the phone as a passkey.
- The roster is kept in Excel sheets with three columns: name, roll number, SNU mail ID ("SNU ID" in the club means the mail ID). Admins paste rows straight from Excel into the Members page; a fourth column `admin` marks admins.
- SNU roll numbers are 10 digits starting with 2 (e.g. `2610110014`) and stay the same for a member's whole tenure. There are no older formats to support.
- Groups and meetings:
  - Seven permanent teams: Event Management, Content, Design, Tech, Videography, PR & Sponsorship, Marketing.
  - Core: the core team, for core-only meetings.
  - Leads: core and sub-core together, for leads meetings. Core members sit in both Core and Leads.
  - Event teams: temporary, with an end date, archived afterwards.
  - Full-body meetings are for every member. All meetings share one 3-strike count.
- People can be added to teams before they first sign in; they join automatically when they do.
- Semesters are set by admins; points reset each semester.
- Before launch, the core members are trying the app and rating it.

## Capabilities and Constraints

- Unexcused absence = 1 point; late check-ins are recorded but not penalised; approved excuse = 0. 2 points → warning, 3 → flagged for admin review (admins decide on deactivation).
- Members can request an excuse up to 24 h after a meeting starts. Closing a meeting marks non-checked-in members absent (or excused). Leads and admins can change a record by hand, with a reason.
- Roles: member, admin, advisor. Admins and advisors aren't counted for full-body meetings; advisors aren't counted anywhere. The advisor role and the first approver are set directly in the database, never from the app.
- Member edits (name, roll number, SNU mail ID, admin rights) by an approver apply at once; other admins' edits wait for an approver. Nobody changes their own rights; losing admin rights also ends approver rights.
- Roster rules: names are capitalised word by word and may not contain numbers; a repeated SNU mail ID or roll number, or one already belonging to someone else, is skipped and reported.
- One passkey per member; one device checks in one member per meeting. Phone changes need an admin reset. Suspicious check-ins are flagged (`new device`, `device mismatch`) and audit-logged.
- Known gap: someone in the room could live-stream the QR to a person outside (~20 s window).
- Mobile-first; members use it almost entirely on phones. Admin and lead screens must also work on phones; the projector view is a large screen.
- Light and dark themes: follows the device by default, with a manual toggle.
- Stack: Next.js App Router + Supabase, deployed on Vercel. Passkeys are bound to the deployed domain, so the domain must not change without resetting passkeys. Database changes ship as numbered SQL migrations that must be run in Supabase before deploying.

## Brand Commitments

- Name: **E-Cell Attendance**.
- Logo: the E-Cell mark (white arrow-and-"e" on a blue circle), at `src/app/icon.png`.
- Voice: casual and club-like. Attendance is a nudge between peers, not a policing tool. Rules are still stated plainly (e.g. "Three strikes. No proxies.").
- No emojis anywhere in the interface.

## Evidence on Hand

- Demo data only: five seeded users in the in-memory backend (an admin who is also an approver, three members, one advisor). Real member data lives in the club's Excel sheets, not in the repo. No usage numbers, ratings or testimonials exist yet; do not invent any.

## Product Principles

1. Check-in must be faster than a roll call: one scan, one fingerprint.
2. Make proxying impossible rather than punishable.
3. Members should always see their own standing without asking anyone.
4. Leads run their own meetings without needing a core admin.
5. Every override is visible: adjustments, resets, member edits and proxy attempts are logged, and edits to members need a second person.

## Accessibility & Inclusion

- Used one-handed on phones in a meeting room: controls are at least 44px tall on touch screens.
- Text meets WCAG AA contrast in both themes; every form field has a visible label.
