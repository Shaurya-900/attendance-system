"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

interface LiveData {
  status: string;
  title: string;
  qr: { url: string; refreshInMs: number } | null;
  checkedIn: { name: string; status: string; flags: string[]; at: string | null }[];
  total: number;
}

export function LiveBoard({ meetingId }: { meetingId: string }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(`/api/admin/meetings/${meetingId}/live`, { cache: "no-store" });
        const json: LiveData = await res.json();
        if (!res.ok) throw new Error((json as unknown as { error: string }).error);
        if (cancelled) return;
        setData(json);
        setError(null);
        setImg(json.qr ? await QRCode.toDataURL(json.qr.url, { width: 720, margin: 1, errorCorrectionLevel: "M" }) : null);
        // Refresh right after the token rotates, and at least every 3s for the attendee list.
        timer = setTimeout(tick, Math.min(3000, (json.qr?.refreshInMs ?? 3000) + 100));
      } catch (e) {
        setError((e as Error).message);
        timer = setTimeout(tick, 3000);
      }
    }
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [meetingId]);

  if (!data) return <p className="muted">{error ?? "Loading…"}</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <div className="card flex flex-col items-center gap-3">
        <h1 className="text-xl font-bold">{data.title}</h1>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="Check-in QR code" data-qr-url={data.qr!.url} className="aspect-square w-full max-w-[min(80vh,640px)] rounded-lg bg-white p-2" />
        ) : (
          <p className="muted py-20">Check-in is {data.status === "closed" ? "closed" : "not started"}. <Link className="underline" href={`/admin/meetings/${meetingId}`}>Back</Link></p>
        )}
        <p className="muted text-sm">Scan with your phone camera · code changes every 10s · confirm with fingerprint</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="card space-y-2">
        <div className="text-3xl font-bold" data-testid="live-count">{data.checkedIn.length} / {data.total}</div>
        <p className="muted text-sm">checked in</p>
        <ul className="max-h-[70vh] space-y-1 overflow-y-auto text-sm">
          {data.checkedIn.map((c, i) => (
            <li key={i}>
              {c.name}
              {c.status === "late" && <span className="ml-1 text-amber-600">late</span>}
              {c.flags.length > 0 && <span className="ml-1 rounded bg-red-600 px-1 text-[10px] font-bold uppercase text-white">{c.flags.join(", ").replace(/_/g, " ")}</span>}
            </li>
          ))}
        </ul>
        <Link className="btn-ghost" href={`/admin/meetings/${meetingId}`}>Manage meeting</Link>
      </div>
    </div>
  );
}
