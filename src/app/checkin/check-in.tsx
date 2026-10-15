"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Receipt, type ReceiptData } from "./receipt";
import { ScanAgain } from "./scan-again";

type Phase = "preparing" | "fingerprint" | "saving";
/** What to offer when tapping Check in again can't help. */
type Next = "rescan" | "me" | "onboard";
type State = { kind: "idle" } | { kind: "busy"; phase: Phase } | { kind: "done"; receipt: ReceiptData } | { kind: "error"; message: string; next?: Next };

class CheckInError extends Error {
  constructor(message: string, readonly next?: Next) { super(message); }
}

const PHASE_LABEL: Record<Phase, string> = { preparing: "Getting ready…", fingerprint: "Confirm with your fingerprint", saving: "Saving…" };
const NO_CONNECTION = "No connection. Check your internet and tap Check in again.";
const TOO_SLOW = "That's taking too long. Check your connection and tap Check in again. If it went through, you'll see your stamp.";
// A crowded room's Wi-Fi can hang a request; give up and say so instead of spinning forever.
const TIMEOUT_MS = 8000;

/** POST JSON; no network, a hung request and a server error each come back as a readable message. */
async function post(url: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new Error((e as Error).name === "TimeoutError" ? TOO_SLOW : NO_CONNECTION);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new CheckInError(json.error || "Check-in didn't go through. Tap Check in to try again.", json.next);
  return json;
}

export function CheckIn({ ticket, title, name, late }: { ticket: string; title: string; name: string; late: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function checkIn() {
    setState({ kind: "busy", phase: "preparing" });
    try {
      const opt = await post("/api/checkin/options", { ticket });
      // Already in the register: the page itself shows that record, so just reload it.
      if (opt.alreadyCheckedIn) return router.refresh();
      setState({ kind: "busy", phase: "fingerprint" });
      const assertion = await startAuthentication({ optionsJSON: opt.options });
      setState({ kind: "busy", phase: "saving" });
      const result = await post("/api/checkin/verify", assertion);
      if (result.alreadyCheckedIn) return router.refresh();
      setState({ kind: "done", receipt: { status: result.status, title, name, clock: result.clock, date: result.date } });
    } catch (e) {
      const err = e as Error;
      // Cancelled or timed-out fingerprint prompt: say what to do next.
      const message = err.name === "NotAllowedError" ? "The fingerprint check was cancelled or timed out. Tap Check in to try again." : err.message;
      setState({ kind: "error", message, next: err instanceof CheckInError ? err.next : undefined });
    }
  }

  if (state.kind === "done") return <Receipt {...state.receipt} />;
  const busy = state.kind === "busy";
  return (
    <div className="space-y-3">
      {/* Above the button, so the button stays put under the thumb for the retry. */}
      {state.kind === "error" && <p role="alert" className="alert alert-error">{state.message}</p>}
      {state.kind === "error" && state.next === "rescan" ? <ScanAgain />
        : state.kind === "error" && state.next === "me" ? <Link href="/me" className="btn w-full py-4 text-lg">Go to my attendance</Link>
        : state.kind === "error" && state.next === "onboard" ? <Link href="/onboard" className="btn w-full py-4 text-lg">Register this phone</Link>
        : (
          <button onClick={checkIn} disabled={busy} aria-busy={busy} className={`btn w-full py-4 text-lg ${late ? "btn-late" : ""}`}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? PHASE_LABEL[state.phase] : "Check in"}
          </button>
        )}
      <p aria-live="polite" className="sr-only">{busy ? PHASE_LABEL[state.phase] : ""}</p>
    </div>
  );
}
