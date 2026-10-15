---
name: E-Cell Attendance
description: The club's attendance register, kept on members' phones.
colors:
  register-ink: "#2341b5"
  register-ink-soft: "#e6ebfb"
  red-pen: "#c62f28"
  red-pen-soft: "#fbe9e7"
  pencil: "#925f07"
  pencil-soft: "#fbf1dc"
  blue-black-ink: "#151b34"
  faded-ink: "#5b6380"
  ruled-line: "#dde2ef"
  register-paper: "#f4f6fb"
  page-white: "#ffffff"
  night-ink: "#8098ff"
  night-ink-soft: "#1d2650"
  night-red-pen: "#ff7a6e"
  night-red-pen-soft: "#3a1a1c"
  night-pencil: "#f0b453"
  night-pencil-soft: "#33280f"
  night-text: "#e7eaf6"
  night-faded-ink: "#9aa2c0"
  night-ruled-line: "#283052"
  night-paper: "#0d1224"
  night-page: "#151b33"
typography:
  display:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
  stamp-word:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 800
    letterSpacing: "0.5px"
  stamp-time:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "1.5px"
  stamp-rim:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 700
    letterSpacing: "2.5px"
rounded:
  focus: "4px"
  sm: "0.5rem"
  md: "0.75rem"
  full: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.register-ink}"
    textColor: "{colors.page-white}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1.125rem"
    height: "2.75rem"
  button-ghost:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.blue-black-ink}"
    rounded: "{rounded.sm}"
    padding: "0.375rem 0.75rem"
    height: "2.25rem"
  button-ghost-hover:
    textColor: "{colors.register-ink}"
  button-ghost-current:
    backgroundColor: "{colors.register-ink-soft}"
    textColor: "{colors.register-ink}"
  card:
    backgroundColor: "{colors.page-white}"
    rounded: "{rounded.md}"
    padding: "1rem"
  input:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.blue-black-ink}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.75rem"
    height: "2.5rem"
  status-present:
    textColor: "{colors.register-ink}"
    typography: "{typography.label}"
  status-late:
    textColor: "{colors.pencil}"
    typography: "{typography.label}"
  status-absent:
    textColor: "{colors.red-pen}"
    typography: "{typography.label}"
  status-excused:
    textColor: "{colors.faded-ink}"
    typography: "{typography.label}"
---

# Design System: E-Cell Attendance

## Overview

**Creative North Star: "The Club Register"**

The app is the club's attendance register, moved onto members' phones. Everything borrows from the paper book a secretary would keep: register paper for the page, blue-black ink for writing, register blue for "present", red pen for absences and strikes, pencil for "late". A check-in is a rubber stamp pressed onto a ruled register page; strikes are punched holes. The props are there to make the rules instantly readable, never to dress the app up.

The mood is friendly, tidy and quick. Members open it for five seconds at the start of a meeting, so screens are short, calm and obvious. The surfaces are soft and approachable: gently rounded cards, inputs and buttons on light paper, with ruled lines rather than shadows separating things. Leads and admins get the same register on denser screens (tables, lists), still readable on a phone.

Dark mode is the same register at night: deep navy paper, pale ink, and lighter versions of the blue, red and pencil so they keep their meaning.

**Key Characteristics:**
- Paper-and-ink palette where every colour has one meaning (present, absent, late).
- Flat, ruled surfaces; depth comes from borders and tinted fills, not shadows.
- Gently rounded, generously sized controls built for thumbs.
- Two signature props: the check-in stamp and the punched strike holes.
- One typeface (Schibsted Grotesk) carrying everything through weight and size.

## Colors

A register on paper: one ink blue that means "present", a red pen that means "absent or struck", a pencil brown for "late", and quiet blue-grey neutrals for the page.

### Primary
- **Register Ink** (#2341b5): the main action colour and the meaning of "present". Primary buttons, active navigation, focus rings, the PRESENT stamp and present marks. Its soft tint, **Register Wash** (#e6ebfb), backs only current-page tabs, text selection, input focus halos and table-row hover.

### Secondary
- **Red Pen** (#c62f28): absences, strikes and errors. Fills the punched strike holes, writes absent and flagged marks, error messages and device flags, and draws the red margin line of the register paper and the member's own history table.

### Tertiary
- **Pencil** (#925f07): late check-ins and warnings (2 strikes). Late and warning marks, the LATE stamp, and the Check in button when the tap will count as late.

### Neutral
- **Blue-Black Ink** (#151b34): all body text and headings.
- **Faded Ink** (#5b6380): secondary text (`muted`): helper copy, table headers, timestamps, roll numbers, labels.
- **Ruled Line** (#dde2ef): every border and divider, card outlines, table rules and the register paper's ruled lines.
- **Register Paper** (#f4f6fb): the page background.
- **Page White** (#ffffff): cards, inputs, ghost buttons and the header, sitting on Register Paper.

Each colour has a night counterpart (the `night-*` tokens), switched by `prefers-color-scheme: dark`. On dark, primary buttons use Night Paper (#0d1224) text on Night Ink instead of white.

### Named Rules
**The One Meaning Rule.** Blue means present or "go", red means absent or struck, pencil means late or warning. Never use one of them decoratively or for a different meaning.

**The Ink-On-Paper Rule.** Status is written straight onto the page in its ink, like a mark in the register: present in Register Ink, late in Pencil, absent in Red Pen, excused in Faded Ink. No pills, washes or boxes behind status or messages. The only solid status colour is a button (Register Ink, or Pencil for a late check-in).

## Typography

**Body Font:** Schibsted Grotesk (self-hosted via `next/font`, falling back to ui-sans-serif, system-ui, sans-serif)

**Character:** a single friendly grotesk with a slightly newspaper-like warmth. Hierarchy comes only from weight and size; there is no second family.

### Hierarchy
- **Display** (800, 2.25rem, line-height 1.05): the login headline ("Three strikes. No proxies.") and nothing else.
- **Headline** (700, 1.5rem): page titles (Groups, Meetings, a group's name). Every h1 gets -0.02em tracking.
- **Title** (600, 1rem): card and section headings (New group, Active, Import members).
- **Body** (400, 0.875rem): lists, tables, forms and most running text; the base page size is 1rem for the few longer paragraphs.
- **Label** (600, 0.75rem): status marks, flags, field captions and stat labels.
- **Big numbers** (700, 1.25rem on My attendance, 1.875rem on the projector's live count): always tabular figures so counts line up.
- **Stamp lettering** (SVG units inside a 200-unit stamp, so they scale with it): the status word (800, 27), the time (600, 13, tracked 1.5) and the rim text (700, 10.5, tracked 2.5, all caps).

### Named Rules
**The Tabular Count Rule.** Any number that is counted or compared (stats, live check-in count, table values) uses tabular figures.

## Layout

A single centred column, max 64rem wide, with a 1rem side gutter. Pages stack their sections vertically with 1rem gaps (`space-y-4`); main content has 1.5rem top padding on phones and 2rem from 640px up. The login page narrows to a 24rem column.

Inside cards, form fields sit in a grid that becomes multi-column from 640px (for example the new-group row: name 2fr, type 1fr, end date 1fr, button auto). Tables scroll horizontally inside their card on narrow screens rather than squashing. The header nav wraps onto a second line on phones instead of hiding items behind a menu.

Spacing follows Tailwind's 0.25rem scale; the steps actually used are 0.25, 0.5, 1, 1.5 and 2rem.

## Elevation & Depth

The system is flat. There are no box shadows on surfaces; depth comes from tone and lines: white cards with a 1px Ruled Line border on Register Paper, and Register Wash for the current tab. The only shadow is the input focus ring (`0 0 0 3px` Register Wash), which reads as a halo rather than lift.

### Named Rules
**The Ruled Page Rule.** Separate things with a ruled line or a change of paper, never with a drop shadow.

## Shapes

Soft and approachable: controls use gently rounded corners (0.5rem), cards are a touch rounder (0.75rem), the group badge is a pill and the strike holes are circles. Borders are thin (1px) except where the register metaphor calls for weight: 2px under table headers, the 2px red margin line, and the stamp's 4px double ring.

## Components

### Buttons
Friendly, chunky and easy to hit with a thumb.
- **Shape:** gently rounded (0.5rem).
- **Primary:** Register Ink fill, white semibold text, 2.75rem tall, 0.5rem × 1.125rem padding. Brightens slightly on hover and nudges down 1px when pressed. Disabled while a form is submitting (55% opacity, progress cursor).
- **Ghost:** Page White with a Ruled Line border, medium weight, 2.25rem tall. On hover the border and text turn Register Ink. As the current tab (sub-navigation), it fills with Register Wash and drops its border.

### Status Marks
Status is text in its ink, no pill: present (Register Ink), late (Pencil), absent (Red Pen), excused (Faded Ink), label size, semibold. The standing mark is three tiny strike holes plus "N pts, good standing / warning / flagged" in the level's ink. Device flags ("new device", "device mismatch") are Red Pen text after a name. The group badge is the one outlined neutral pill, naming the group or "Full body".

### Cards / Containers
- **Corner Style:** 0.75rem.
- **Background:** Page White on Register Paper.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Ruled Line.
- **Internal Padding:** 1rem.

### Inputs / Fields
- **Style:** Page White, 1px Ruled Line border, 0.5rem radius, 2.5rem tall, full width.
- **Focus:** border turns Register Ink with a 3px Register Wash halo. Elsewhere, keyboard focus is a 2px Register Ink outline offset by 2px.
- **Error:** shown below the form as an error alert, not on the field.

### Messages
Written on the page in ink, never boxed: no wash, no border, no padding. Body size (0.875rem), weight 500. Notes, warnings and confirmations ("You're past the start, so this counts as late", "Phone registered") are Blue-Black Ink; errors are Red Pen. Multi-line messages keep their line breaks.

### Navigation
The top bar is Page White with a ruled bottom edge: the E-Cell logo and "E-Cell Attendance" in bold, then text links. The current link is Register Ink, semibold, with a 2px underline 6px below. On phones the links wrap onto a second line. Admin sections add a row of ghost-button tabs underneath.

### Tables
Full width, body size. Headers are semibold Faded Ink over a 2px ruled line; rows are separated by 1px ruled lines and tint with Register Wash on hover. On a member's own history, the first column carries a red margin line, like a paper register.

### Strike Holes (signature)
Three punched circles (the 3-strike limit), outlined in faded ink. Each strike point fills a hole with Red Pen from left to right (half points fill half a hole); a full hole gets a red rim. Used large on My attendance, small inside standing badges. Screen readers hear "N of 3 strikes".

### Register Line (signature)
The member's line in the register: a ruled card (Register Paper's ruled lines and red margin on Page White) with their name on the left of a dashed line and their mark on the right in its ink: "not in yet" before check-in, "late" in Pencil when the tap will count as late, "absent" in Red Pen or "excused" in Faded Ink on a closed meeting. It's labelled for screen readers as "Your line in the register: …".

### Check-in Receipt and Stamp (signature)
On a successful check-in the whole screen becomes a ruled register page (covering the header). The meeting name is the heading (with ": present" or ": late" for screen readers), and below it the same register line the ready screen showed, with an SVG rubber stamp (13rem, tilted -6°) pressed over its right end, exactly where "not in yet" was. The stamp has a heavy outer ring and a thin inner ring, "E-CELL ATTENDANCE" around the top, the date around the bottom, the status word in the middle and the check-in time under it. Its ink is the status: Register Ink stamps **PRESENT**, Pencil stamps **LATE**. Under it: one sentence with the time, a reassurance line ("Late doesn't count as a strike. You can put your phone away.") and "View my attendance", which only becomes tappable after 0.6s so a second tap on Check in can't skip the stamp.

The stamp is the app's one orchestrated moment: it is pressed on in 0.45s with an exponential ease-out (`cubic-bezier(.16, 1, .3, 1)`), from 1.35× scale, -16° and a 2px blur to rest. It starts fully visible. Revisiting an existing check-in shows it already in place, and reduced-motion users never see it move.

### Check-in Screen
One column, max 28rem. The meeting name is the heading, with the group, start time and minutes since the start under it. If the member scanned after the grace period, a line says it counts as late (no strike), their register line reads "late" in Pencil and the Check in button itself is Pencil. Late is decided by the scan time, so what the screen shows is what the stamp says. On phones the button and its helper text sit low in the thumb zone. While working, the button keeps full contrast with a small spinning ring and names the step: "Getting ready…", "Confirm with your fingerprint", "Saving…"; requests give up after 8s. Errors appear above the button so it never moves; when tapping again can't help, the button is replaced by the right next step ("Scan again", "Go to my attendance" or "Register this phone"). Help and "Sign out and switch account" live in a "No fingerprint prompt, or not you?" disclosure.

### Check-in Notices
Dead ends (no code, expired code, not open yet, closed, wrong group, phone registered) share the check-in layout: headline, one ink sentence with the next step, and the action low in the thumb zone. "Scan again" opens an in-page QR scanner (square camera view, Cancel underneath); browsers without one are told to use the camera app. A closed meeting shows the member's register line with their mark and links straight to the excuse form.

## Do's and Don'ts

### Do:
- **Do** take every colour from the CSS variables in `src/app/globals.css` (`--accent`, `--red`, `--pencil`, `--muted`, `--border`, …) so dark mode follows automatically.
- **Do** keep status as ink on its own wash: present blue, late pencil, absent red, excused grey.
- **Do** keep tap targets at least 2.75rem tall for primary actions and for the one secondary action on a phone-first screen (`btn-tall`); 2.25rem is the floor elsewhere.
- **Do** separate surfaces with 1px Ruled Line borders and white-on-paper contrast.
- **Do** use tabular figures for any count.
- **Do** reuse the `.card`, `.btn`, `.btn-ghost`, `.input`, `.alert` classes and the `StrikeHoles` / badge components before writing new styles.

### Don't:
- **Don't** add drop shadows to cards, buttons or the header.
- **Don't** use red, blue or pencil for decoration or for a meaning other than their status.
- **Don't** add a second typeface; make hierarchy with weight and size.
- **Don't** add motion beyond quick state transitions and the busy spinner; the stamp is the only choreographed animation, and nothing bounces or overshoots.
- **Don't** box messages in tinted panels (yellow, red, blue or green); write them on the page in ink.
- **Don't** put a thick coloured edge on one side of a card or list item.
- **Don't** stamp a status in a colour that doesn't match it; the stamp's ink is the status (One Meaning Rule).
- **Don't** hide navigation behind a menu on phones; let it wrap.
