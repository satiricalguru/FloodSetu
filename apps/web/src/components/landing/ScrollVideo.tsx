"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Full-screen aerial river flyover whose playhead follows the page scroll (top of page = first frame,
 * bottom = last frame). The files are encoded all-intra (every frame a keyframe, see public/media), so
 * seeking backwards is as smooth as forwards. Reduced motion → the poster frame only.
 */
export default function ScrollVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // H.264 all-intra seeks best; browsers without proprietary codecs (e.g. open-source Chromium) get VP9 WebM
    const probe = document.createElement("video");
    const ext = probe.canPlayType('video/mp4; codecs="avc1.640028"') ? "mp4" : "webm";
    // object-cover on a portrait phone scales by height, so size the choice by the 16:9 width actually covered
    const covered = Math.max(window.innerWidth, (window.innerHeight * 16) / 9) * Math.min(2, window.devicePixelRatio || 1);
    setSrc(`/media/flood-aerial${covered < 1100 ? "-sm" : ""}.${ext}`);
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    let raf = 0;
    let shown = 0; // eased playhead (s)
    // iOS Safari only decodes frames for seeking after the element has played once (muted autoplay is allowed)
    v.play().then(() => v.pause()).catch(() => {});
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const d = v.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      const target = p * (d - 0.05);
      shown += (target - shown) * 0.12; // a little inertia so the flyover glides instead of stepping
      // don't queue seeks: one in flight at a time, and skip sub-frame changes (24 fps)
      if (!v.seeking && Math.abs(v.currentTime - shown) > 1 / 48) v.currentTime = shown;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [src]);

  return (
    <video
      ref={ref}
      src={src ?? undefined}
      poster="/media/flood-aerial-poster.jpg"
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden
      tabIndex={-1}
      className="absolute inset-0 h-full w-full object-cover"
      // pull the bright daytime footage toward the night-terminal palette so type stays readable
      style={{ filter: "saturate(0.8) brightness(0.62) contrast(1.06)" }}
    />
  );
}
