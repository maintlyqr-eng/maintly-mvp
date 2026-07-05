"use client";

import { useRef, useState } from "react";

type Props = {
  src: string;
  size?: number; // small avatar diameter, px
  previewSize?: number; // enlarged preview diameter, px
  className?: string;
};

// A small circular avatar that shows a large preview of the same photo
// while hovered, so a face isn't stuck guessing what a 32px circle shows.
export default function HoverAvatar({ src, size = 36, previewSize = 176, className = "" }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function handleEnter() {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - previewSize / 2),
      window.innerWidth - previewSize - 8
    );
    setPos({ top: rect.bottom + 8, left });
    setHover(true);
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt=""
        onMouseEnter={handleEnter}
        onMouseLeave={() => setHover(false)}
        className={`rounded-full object-cover cursor-pointer ${className}`}
        style={{ width: size, height: size }}
      />
      {hover && (
        <div className="fixed z-[100] pointer-events-none" style={{ top: pos.top, left: pos.left }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="rounded-full object-cover border-4 border-white shadow-2xl"
            style={{ width: previewSize, height: previewSize }}
          />
        </div>
      )}
    </>
  );
}
