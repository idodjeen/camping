"use client";

import { useState } from "react";

import { gradientFor, initialFor } from "@/lib/gradient";
import { cn } from "@/lib/utils";

/**
 * Avatar with a graceful fallback.
 *
 * Avatar files are optional — they live at /public/avatars/{slug}.jpg and may
 * simply not exist yet. A plain <img> is used rather than next/image precisely
 * so that a 404 fires onError and we can swap in the deterministic gradient
 * initial. next/image would render a broken optimizer request instead.
 */
export function UserAvatar({
  name,
  slug,
  avatarUrl,
  size = 36,
  className,
  title,
}: {
  name: string;
  slug: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(avatarUrl) && !failed;

  return (
    <span
      title={title ?? name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-2 ring-night-900",
        !showImage && `bg-gradient-to-br ${gradientFor(slug)}`,
        className,
      )}
    >
      {showImage ? (
        <img
          src={avatarUrl!}
          alt={name}
          width={size}
          height={size}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialFor(name)
      )}
    </span>
  );
}
