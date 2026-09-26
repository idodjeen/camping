"use client";

import { useState } from "react";

import { Lightbox } from "@/components/lightbox";
import type { ImageView } from "@/lib/cloudinary";

/**
 * A photo inside a message bubble.
 *
 * A plain <img> rather than next/image, the same choice UserAvatar makes: the
 * source is a Cloudinary delivery URL that already picks format and quality
 * per browser, so the optimizer would only add a hop.
 *
 * The box is reserved from the stored dimensions before anything loads. The
 * chat decides whether to follow a new message by comparing scroll position
 * against `scrollHeight`, so an image that grows the page after the fact would
 * pull the reader away from whatever they were reading.
 */
export function ChatImage({
  image,
  alt,
  /**
   * The merged timeline draws each message inside a button that opens its
   * thread, and a button inside a button is invalid markup — and the wrong
   * behaviour there anyway, where a tap should reach the thread.
   */
  tappable = true,
}: {
  image: ImageView;
  alt: string;
  tappable?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Floor the ratio so a tall portrait shot cannot take over the thread.
  const ratio = image.width && image.height ? image.width / image.height : 4 / 3;
  const box = "mt-1 block w-full overflow-hidden rounded-xl bg-white/5";
  const style = { aspectRatio: String(Math.max(ratio, 0.6)) };

  const photo = (
    <img
      src={image.thumbUrl}
      alt={alt}
      loading="lazy"
      decoding="async"
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      className="size-full object-cover"
    />
  );

  if (!tappable) {
    return (
      <span className={box} style={style}>
        {photo}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${alt} — להגדלה`}
        className={`${box} active:opacity-80`}
        style={style}
      >
        {photo}
      </button>
      <Lightbox open={open} onClose={() => setOpen(false)} src={image.url} alt={alt} />
    </>
  );
}
