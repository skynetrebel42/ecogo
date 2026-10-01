// CameraScanner.tsx — live back-camera view that reads grocery barcodes on its own (M6 spec §4.3).
// Frames are read on the device and never uploaded. The camera stops on close, on unmount, and when the page is hidden.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Zap, ZapOff, ChevronUp, ChevronDown, CameraOff } from "lucide-react";
import { createDetector } from "../../lib/barcodeReader";
import { confirmReads, normalizeScanned, CAMERA_CONSTRAINTS } from "../../lib/scanner";

/** Open the site with ?debug to see the real camera size and how many frames were read (evidence for scan problems). */
const DEBUG = typeof location !== "undefined" && new URLSearchParams(location.search).has("debug");

type CameraState = "requesting" | "live" | "paused" | "denied" | "unsupported";

const MESSAGE: Record<Exclude<CameraState, "live">, string> = {
  requesting: "Allow camera access to scan barcodes.",
  paused: "Camera paused.",
  denied: "Camera blocked. Allow it in your browser's site settings, or type the barcode below.",
  unsupported: "No camera available. Type the barcode below.",
};

export default function CameraScanner({ onCode, onClose, children }: {
  onCode: (code: string) => void;  // a confirmed barcode (read twice in a row)
  onClose: () => void;             // ✕: back to the manual view
  children: ReactNode;             // the drawer: type-a-barcode and demo barcodes
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [state, setState] = useState<CameraState>("requesting");
  const [torch, setTorch] = useState<boolean | null>(null); // null = this camera has no torch
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [run, setRun] = useState(0); // bump to restart after a pause
  const [debug, setDebug] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer = 0;
    const stop = () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach(t => t.stop());
      trackRef.current = null;
    };
    const fail = (s: "denied" | "unsupported") => { if (!stopped) { setState(s); setDrawerOpen(true); } stop(); };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return fail("unsupported");
      try {
        stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        return fail(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported");
      }
      if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
      const video = videoRef.current;
      if (!video) return stop();
      video.srcObject = stream;
      await video.play().catch(() => {});
      if (stopped) return; // paused or closed while the camera was starting: don't overwrite "Camera paused."
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean; focusMode?: string[] };
      setTorch(caps.torch ? false : null);
      // Sharper frames for the reader where the camera allows it (Android, some webcams; iOS ignores it).
      if (caps.focusMode?.includes("continuous")) {
        track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
      }
      setState("live");

      let detector;
      try { detector = await createDetector(); } catch (err) {
        console.error("[scanner] the barcode reader failed to load", err);
        return fail("unsupported");
      }
      const confirm = confirmReads();
      let frames = 0;
      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          try {
            const found = await detector.detect(video);
            if (DEBUG && ++frames % 5 === 0) setDebug(`${video.videoWidth}×${video.videoHeight} · ${frames} frames · last: ${found[0]?.rawValue ?? "none"}`);
            const code = confirm(normalizeScanned(found[0]?.rawValue ?? "", found[0]?.format));
            if (code && !stopped) {
              navigator.vibrate?.(60);
              stop();
              onCodeRef.current(code);
              return;
            }
          } catch (err) {
            // a bad frame: try the next one (with ?debug, show why; e.g. the reader's .wasm failed to load)
            if (DEBUG) setDebug(`${video.videoWidth}×${video.videoHeight} · reader error: ${err instanceof Error ? err.message : String(err)}`.slice(0, 160));
          }
        }
        timer = window.setTimeout(tick, 150);
      };
      tick();
    })();

    const onVisibility = () => { if (document.hidden && !stopped) { stop(); setState("paused"); } };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { document.removeEventListener("visibilitychange", onVisibility); stop(); };
  }, [run]);

  const toggleTorch = async () => {
    const next = !torch;
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch { setTorch(null); }
  };

  return (
    <div className="h-full relative flex flex-col bg-black text-white overflow-hidden">
      <video ref={videoRef} playsInline muted autoPlay aria-label="Camera view"
        className={`absolute inset-0 w-full h-full object-cover ${state === "live" ? "" : "opacity-0"}`} />

      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <button onClick={onClose} aria-label="Close camera" className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
          <X size={18} />
        </button>
        {torch !== null && (
          <button onClick={toggleTorch} aria-label={torch ? "Turn torch off" : "Turn torch on"} aria-pressed={torch}
            className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
            {torch ? <ZapOff size={18} /> : <Zap size={18} />}
          </button>
        )}
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        {state === "live" ? (
          <>
            <div className="relative w-64 h-40">
              {(["top-0 left-0 border-t-4 border-l-4 rounded-tl-xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl",
                 "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl"] as const)
                .map((cls, i) => <div key={i} className={`absolute w-8 h-8 border-white ${cls}`} />)}
            </div>
            <p className="mt-4 text-sm font-semibold drop-shadow">Point at a barcode</p>
            {DEBUG && <p className="mt-2 text-[10px] font-mono bg-black/60 rounded px-2 py-1">{debug || "debug: waiting for frames"}</p>}
          </>
        ) : (
          <>
            {state !== "requesting" && <CameraOff size={36} className="mb-3 text-white/70" />}
            <p className="text-sm text-white/80 max-w-xs leading-relaxed">{MESSAGE[state]}</p>
            {state === "paused" && (
              <button onClick={() => { setState("requesting"); setRun(r => r + 1); }}
                className="mt-4 px-5 py-3 rounded-2xl bg-white/15 text-sm font-bold">Resume camera</button>
            )}
          </>
        )}
      </div>

      <div className="relative z-10 px-4 pb-4 space-y-2">
        <p className="text-center text-[10px] text-white/70">Scanning happens on your phone. No images are uploaded.</p>
        <button onClick={() => setDrawerOpen(o => !o)} aria-expanded={drawerOpen}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-black/50 border border-white/15 text-xs font-semibold">
          <span>Type a barcode or try a demo</span>
          {drawerOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {drawerOpen && <div className="rounded-2xl bg-black/70 border border-white/10 p-3 space-y-3">{children}</div>}
      </div>
    </div>
  );
}
