import { useMemo, useState } from 'react';
import { faviconCandidates, hueFromString, initialsOf } from '../lib/favicon';

/**
 * Tries: custom icon → Google favicon service → DuckDuckGo → generated monogram.
 * Tiny (≤16px) results are rejected because they're usually a generic globe.
 */
export default function GameIcon({ name = '', url = '', iconUrl = '', color = '', size = 48, className = '' }) {
  const sources = useMemo(
    () => [iconUrl, ...faviconCandidates(url)].filter(Boolean),
    [iconUrl, url],
  );
  const key = sources.join('|');
  return <IconInner key={key} sources={sources} name={name} color={color} size={size} className={className} />;
}

function IconInner({ sources, name, color, size, className }) {
  const [idx, setIdx] = useState(0);
  const hue = hueFromString(name || 'game');
  const radius = Math.round(size * 0.28);
  const failed = idx >= sources.length;

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: failed
          ? color
            ? `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #000))`
            : `linear-gradient(135deg, hsl(${hue} 80% 58%), hsl(${(hue + 50) % 360} 80% 45%))`
          : 'rgba(255,255,255,0.92)',
        boxShadow: `0 6px 20px -6px ${color ? `color-mix(in srgb, ${color} 60%, transparent)` : `hsl(${hue} 80% 50% / 0.55)`}, inset 0 0 0 1px rgba(255,255,255,0.12)`,
      }}
    >
      {failed ? (
        <span
          className="absolute inset-0 grid place-items-center font-bold text-white"
          style={{ fontSize: size * 0.36, letterSpacing: '-0.02em' }}
        >
          {initialsOf(name)}
        </span>
      ) : (
        <img
          src={sources[idx]}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-contain p-[14%]"
          onError={() => setIdx((i) => i + 1)}
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth <= 16) setIdx((i) => i + 1);
          }}
        />
      )}
    </div>
  );
}
