"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Receipt, type ReceiptData } from "./receipt";

type State = { kind: "idle" | "busy" } | { kind: "done"; receipt: ReceiptData } | { kind: "error"; message: string };

const NO_CONNECTION = "No connection. Check your internet and tap Check in again.";

/** POST JSON; a failed request (no network) and a server error each come back as a readable message. */
async function post(url: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error(NO_CONNECTION);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Check-in didn't go through. Tap Check in to try again.");
  return json;
}

export function CheckIn({ ticket, title, name }: { ticket: string; title: string; name: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function checkIn() {
    setState({ kind: "busy" });
    try {
      const opt = await post("/api/checkin/options", { ticket });
      // Already in the register: the page itself shows that record, so just reload it.
      if (opt.alreadyCheckedIn) return router.refresh();
      const result = await post("/api/checkin/verify", await startAuthentication({ optionsJSON: opt.options }));
      if (result.alreadyCheckedIn) return router.refresh();
      setState({ kind: "done", receipt: { status: result.status, title, name, clock: result.clock, date: result.date } });
    } catch (e) {
      const err = e as Error;
      // Cancelled or timed-out fingerprint prompt: say what to do next.
      const message = err.name === "NotAllowedError" ? "The fingerprint check was cancelled or timed out. Tap Check in to try again." : err.message;
      setState({ kind: "error", message });
    }
  }

  if (state.kind === "done") return <Receipt {...state.receipt} />;
  const busy = state.kind === "busy";
  return (
    <div className="space-y-3">
      <button onClick={checkIn} disabled={busy} aria-busy={busy} className="btn w-full py-4 text-lg">
        {busy && <span className="spinner" aria-hidden="true" />}
        {busy ? "Waiting for your fingerprint…" : "Check in"}
      </button>
      <p aria-live="polite" className="sr-only">{busy ? "Waiting for your fingerprint or face." : ""}</p>
      {state.kind === "error" && <p role="alert" className="alert alert-error">{state.message}</p>}
    </div>
  );
}
