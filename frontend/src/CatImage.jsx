import { useState } from "react";
import { CAT_IMAGES } from "./catImages.js";

export function CatFace({ mood = "happy", className = "", width, height }) {
  const eyes = {
    grumpy: <path d="m42 45 8 4m30-4-8 4" />,
    sad: <path d="M45 47h.1m30 0h.1" />,
    neutral: <path d="M45 46h.1m30 0h.1" />,
    happy: <path d="M44 48q4-7 8 0m22 0q4-7 8 0" />,
    delighted: <path d="M42 47q6-10 12 0m18 0q6-10 12 0" />,
  }[mood] || null;
  const mouth = {
    grumpy: <path d="M55 65q5-6 10 0" />,
    sad: <path d="M55 66q5-7 10 0" />,
    neutral: <path d="M56 64h8" />,
    happy: <path d="M54 61q7 9 14 0" />,
    delighted: <path d="M53 59q8 17 16 0z" />,
  }[mood] || null;

  return (
    <svg
      className={`cat-face-fallback ${className}`}
      viewBox="0 0 120 100"
      width={width}
      height={height}
      role="img"
      aria-label={`Cream kitten with a ${mood} expression`}
    >
      <path d="m25 33 8-25 23 18m30 7-8-25-23 18" fill="#fff3dc" stroke="#704f4a" strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="60" cy="53" rx="42" ry="37" fill="#fff3dc" stroke="#704f4a" strokeWidth="4" />
      <g fill="none" stroke="#583f42" strokeWidth="4" strokeLinecap="round">{eyes}{mouth}</g>
      <path d="m23 53-17-5m17 13-16 3m90-11 17-5m-17 13 16 3" stroke="#805d52" strokeWidth="2" strokeLinecap="round" />
      <circle cx="35" cy="60" r="6" fill="#f3a5ad" opacity=".8" /><circle cx="85" cy="60" r="6" fill="#f3a5ad" opacity=".8" />
    </svg>
  );
}

export default function CatImage({
  name,
  className = "",
  width = 240,
  height = 240,
  loading = "lazy",
  fetchPriority,
  fallbackMood = "happy",
}) {
  const [failed, setFailed] = useState(false);
  const image = CAT_IMAGES[name];

  if (!image || failed) {
    return <CatFace mood={fallbackMood} className={className} width={width} height={height} />;
  }

  return (
    <picture className={`cat-picture ${className}`}>
      <source srcSet={image.webp} type="image/webp" />
      <img
        src={image.png}
        alt={image.alt}
        width={width}
        height={height}
        loading={loading}
        fetchPriority={fetchPriority}
        onError={() => setFailed(true)}
      />
    </picture>
  );
}
