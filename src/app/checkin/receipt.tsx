"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/** `clock` is null when a lead marked them in by hand. */
export type ReceiptData = { status: "present" | "late"; title: string; name: string; clock: string | null; date: string; already?: boolean };

/** The whole screen becomes the register page, stamped PRESENT (register ink) or LATE (pencil). */
export function Receipt({ status, title, name, clock, date, already = false }: ReceiptData) {
  const heading = useRef<HTMLHeadingElement>(null);
  // The Check in button this replaces is gone, so put focus (and screen readers) on the result.
  useEffect(() => heading.current?.focus(), []);
  const late = status === "late";
  return (
    <section className="receipt" data-status={status} aria-labelledby="receipt-title">
      <div className="receipt-sheet">
        {/* The stamp is a picture, so the heading carries the status for screen readers. */}
        <h1 id="receipt-title" ref={heading} tabIndex={-1} className="text-3xl font-bold">{title}<span className="sr-only">: {late ? "late" : "present"}</span></h1>

        {/* The same register line the ready screen showed, now stamped where it said "not in yet". */}
        <div className="stamped-line">
          <div className="register-line">
            <span className="truncate">{name}</span>
            <span className="register-mark">{late ? "late" : "present"}</span>
          </div>
          <svg className="stamp" data-landing={already ? undefined : ""} viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <path id="stamp-top" d="M 30 100 A 70 70 0 0 1 170 100" />
              <path id="stamp-bottom" d="M 22 100 A 78 78 0 0 0 178 100" />
            </defs>
            <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="4" />
            <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <text className="stamp-rim"><textPath href="#stamp-top" startOffset="50%" textAnchor="middle">E-CELL ATTENDANCE</textPath></text>
            <text className="stamp-rim"><textPath href="#stamp-bottom" startOffset="50%" textAnchor="middle">{date}</textPath></text>
            <text className="stamp-word" x="100" y="108" textAnchor="middle">{late ? "LATE" : "PRESENT"}</text>
            {clock && <text className="stamp-time" x="100" y="132" textAnchor="middle">{clock.toUpperCase()}</text>}
          </svg>
        </div>

        <p role="status" className="text-lg font-semibold">
          {!clock ? "Your lead marked you in." : already ? `You were already checked in at ${clock}.` : `You're checked in at ${clock}.`}
        </p>
        {late && <p className="muted">Late doesn&apos;t count as a strike. You can put your phone away.</p>}
        {!late && <p className="muted">That&apos;s it. You can put your phone away.</p>}
        {/* Armed after a beat, so a second tap on Check in can't skip past the stamp. */}
        <Link href="/me" className="btn-ghost btn-tall arm-late">View my attendance</Link>
      </div>
    </section>
  );
}
