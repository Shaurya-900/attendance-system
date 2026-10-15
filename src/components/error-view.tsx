"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

/** Shown instead of a crash page when loading a page or saving a form fails. */
export function ErrorView({ error, reset, home = "/" }: { error: Error & { digest?: string }; reset: () => void; home?: string }) {
  const router = useRouter();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div role="alert" className="card mx-auto max-w-md space-y-3 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="muted text-sm">
        That didn&apos;t work, and your last change may not have been saved. Check your connection and try again.
        If it keeps happening, tell an admin{error.digest ? <> (error code <code>{error.digest}</code>)</> : null}.
      </p>
      <div className="flex justify-center gap-2">
        <button className="btn" onClick={() => startTransition(() => { router.refresh(); reset(); })}>Try again</button>
        <Link className="btn-ghost" href={home}>Go back</Link>
      </div>
    </div>
  );
}
