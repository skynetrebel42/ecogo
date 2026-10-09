// CropPhoto.tsx — crop a label photo before it's sent (M8 follow-up 6, K4): drag a corner, or the rectangle itself, then
// Done or Cancel. The crop goes through preparePhoto again, so Open Food Facts' minimum size still applies.

import { useEffect, useMemo, useRef, useState, type PointerEvent, type SyntheticEvent } from "react";
import { dragCrop, preparePhoto, TOO_SMALL, type Crop } from "../../lib/photo";

type Handle = "nw" | "ne" | "sw" | "se" | "move";
const CORNERS = ["nw", "ne", "sw", "se"] as const;

export default function CropPhoto({ photo, label, onDone, onCancel }: {
  photo: Blob; label: string; onDone: (cropped: Blob) => void; onCancel: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(photo), [photo]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, w: 1, h: 1 });
  const [size, setSize] = useState<{ width: number; height: number }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Crop }>();

  // The photo fits the free space (less 24 px each side, room for the corner handles), so the rectangle's shares match it.
  const fit = (e: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget, a = area.current!;
    const s = Math.min((a.clientWidth - 48) / w, (a.clientHeight - 48) / h);
    setSize({ width: w * s, height: h * s });
  };
  const down = (handle: Handle) => (e: PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { handle, x: e.clientX, y: e.clientY, start: crop };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (d && size) setCrop(dragCrop(d.start, d.handle, (e.clientX - d.x) / size.width, (e.clientY - d.y) / size.height));
  };
  const done = async () => {
    setBusy(true); setError(undefined);
    try { onDone(await preparePhoto(photo, crop)); } catch (err) {
      setError((err as Error).message === TOO_SMALL ? TOO_SMALL : "Couldn't crop this photo. Try again.");
      setBusy(false);
    }
  };
  const pct = (v: number) => `${v * 100}%`;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0F1F16] text-white">
      <div className="px-4 pt-5">
        <h1 className="text-xl font-extrabold">Crop the {label.toLowerCase()} photo</h1>
        <p className="text-sm text-[#D1DAD4]">Drag the corners so only the label is inside.</p>
      </div>
      <div ref={area} className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
        <div className="relative touch-none select-none" style={size ?? { width: 0, height: 0 }}
          onPointerMove={move} onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}>
          <img src={url} alt={`${label} photo`} draggable={false} onLoad={fit} className="block w-full h-full" />
          <div data-crop onPointerDown={down("move")} className="absolute border-2 border-white cursor-move"
            style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h), boxShadow: "0 0 0 9999px rgba(0,0,0,.55)" }}>
            {CORNERS.map(h => (
              <div key={h} data-handle={h} onPointerDown={down(h)} aria-hidden="true"
                className="absolute w-11 h-11 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                style={{ left: h[1] === "w" ? 0 : "100%", top: h[0] === "n" ? 0 : "100%" }}>
                <span className="w-5 h-5 rounded-md bg-white shadow" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {error && <p role="alert" className="px-4 text-sm text-amber-300 text-center">{error}</p>}
      <div className="px-4 pt-3 pb-6 flex gap-2.5">
        <button onClick={onCancel} className="min-h-[52px] px-5 rounded-2xl border border-white/30 bg-white/10 font-bold text-sm">Cancel</button>
        <button onClick={done} disabled={busy}
          className="flex-1 min-h-[52px] rounded-2xl bg-[#F59E0B] text-[#1A1200] font-extrabold text-[15px] disabled:opacity-50">Done</button>
      </div>
    </div>
  );
}
