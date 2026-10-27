"use client";

import { useEffect, useRef, useState } from "react";

// Not in TypeScript's DOM types yet. Chrome on Android has it; iOS Safari and some others don't, so jsQR stands in.
type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
declare global { interface Window { BarcodeDetector?: new (opts: { formats: string[] }) => Detector } }

type State = "idle" | "scanning" | "unsupported" | "denied";

/** Decodes with jsQR from a canvas snapshot of the video, loaded only when the browser has no BarcodeDetector. */
async function jsqrDetector(): Promise<Detector> {
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return {
    async detect(el) {
      if (!el.videoWidth) return [];
      canvas.width = el.videoWidth;
      canvas.height = el.videoHeight;
      ctx.drawImage(el, 0, 0);
      const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      return code ? [{ rawValue: code.data }] : [];
    },
  };
}

/**
 * Scans the code on the projector right here, in the browser the phone was registered in. A camera app opens
 * the default browser instead, which may not hold the passkey ("No available sign-in").
 */
export function ScanAgain({ secondary = false, label = "Scan again" }: { secondary?: boolean; label?: string }) {
  const [state, setState] = useState<State>("idle");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => stop, []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) return setState("unsupported");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    } catch {
      return setState("denied");
    }
    setState("scanning");
  }

  useEffect(() => {
    if (state !== "scanning" || !video.current || !stream.current) return;
    const el = video.current;
    el.srcObject = stream.current;
    void el.play();
    let frame = 0;
    let cancelled = false;
    const detectorReady = window.BarcodeDetector ? Promise.resolve<Detector>(new window.BarcodeDetector({ formats: ["qr_code"] })) : jsqrDetector();
    const tick = async () => {
      const detector = await detectorReady;
      if (cancelled) return;
      const found = await detector.detect(el).catch(() => []);
      if (cancelled) return;
      for (const { rawValue } of found) {
        const url = new URL(rawValue, location.href);
        // Only follow this site's own check-in codes.
        if (url.origin === location.origin && url.pathname === "/checkin") {
          stop();
          return location.assign(url.href);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [state]);

  if (state === "scanning") {
    return (
      <div className="space-y-3">
        <video ref={video} className="scanner" muted playsInline aria-label="Camera view: point it at the code on the screen" />
        <button className="btn-ghost btn-tall w-full" onClick={() => { stop(); setState("idle"); }}>Cancel</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {state === "unsupported" && <p className="alert">This browser can&apos;t scan by itself. Open your camera app and point it at the code on the screen.</p>}
      {state === "denied" && <p className="alert alert-error">Camera access was blocked. Allow it in your browser settings, or use your camera app instead.</p>}
      <button className={secondary ? "btn-ghost btn-tall w-full" : "btn w-full py-4 text-lg"} onClick={start}>{label}</button>
    </div>
  );
}
