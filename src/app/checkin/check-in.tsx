"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import Link from "next/link";
import { useState } from "react";

type State = { kind: "idle" | "busy" } | { kind: "done"; message: string } | { kind: "error"; message: string };

export function CheckIn({ ticket }: { ticket: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function checkIn() {
    setState({ kind: "busy" });
    try {
      const optRes = await fetch("/api/checkin/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      });
      const opt = await optRes.json();
      if (!optRes.ok) throw new Error(opt.error);
      if (opt.alreadyCheckedIn) return setState({ kind: "done", message: `You're already checked in (${opt.status}).` });

      const assertion = await startAuthentication({ optionsJSON: opt.options });
      const res = await fetch("/api/checkin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setState({
        kind: "done",
        message: result.alreadyCheckedIn ? "You're already checked in." : `Checked in to ${result.meetingTitle}${result.status === "late" ? " (marked late)" : ""}.`,
      });
    } catch (e) {
      const err = e as Error;
      // Cancelled or timed-out fingerprint prompt, or a dropped connection: say what to do next.
      const message = err.name === "NotAllowedError" ? "Fingerprint check was cancelled or timed out. Tap Check in to try again."
        : err.name === "TypeError" ? "No connection. Check your internet and tap Check in again."
        : err.message || "Check-in failed. Tap Check in to try again.";
      setState({ kind: "error", message });
    }
  }

  if (state.kind === "done") {
    return (
      <div role="status" className="card space-y-4 py-8 text-center">
        <div className="stamp" aria-hidden="true">
          <span className="text-2xl font-extrabold tracking-tight">Present</span>
        </div>
        <p className="font-semibold">{state.message}</p>
        <Link href="/me" className="btn-ghost">View my attendance</Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <button onClick={checkIn} disabled={state.kind === "busy"} className="btn w-full py-4 text-lg">
        {state.kind === "busy" ? "Confirm on your phone…" : "Check in"}
      </button>
      {state.kind === "error" && <p role="alert" className="alert alert-error">{state.message}</p>}
    </div>
  );
}
