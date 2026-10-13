"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterPasskey({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const optRes = await fetch("/api/passkey/register/options", { method: "POST" });
      const options = await optRes.json();
      if (!optRes.ok) throw new Error(options.error);
      const attestation = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch("/api/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attestation),
      });
      const result = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(result.error);
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError((e as Error).message || "Registration failed.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button onClick={register} disabled={busy} className="btn w-full py-3 text-base">{busy ? "Waiting for your phone…" : "Register this phone"}</button>
      {error && <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-800">{error}</p>}
    </div>
  );
}
