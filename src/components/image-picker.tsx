"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { toast } from "@/components/toast";
import { ApiError, send } from "@/lib/api";
import { cn } from "@/lib/utils";

/** A photo already sitting in Cloudinary, waiting to be sent with a message. */
export type Attachment = {
  publicId: string;
  width: number;
  height: number;
  /** A local object URL, so the preview costs no round trip. */
  previewUrl: string;
};

type Signature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  endpoint: string;
};

const MAX_EDGE = 1600;

/**
 * Re-encode the photo in the browser before it leaves the device.
 *
 * A phone camera file is 4–8MB, which is slow to upload on mobile data and
 * pointless for a bubble a few hundred pixels wide. Going through a canvas
 * also drops the EXIF block, so the GPS coordinates of wherever the photo was
 * taken do not travel with it.
 */
async function downscale(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  // `from-image` applies the orientation tag; without it phone photos that
  // were taken sideways upload sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  if (!blob) throw new Error("encode failed");
  return { blob, width, height };
}

/** XHR rather than fetch, which still cannot report upload progress. */
function upload(sig: Signature, blob: Blob, onProgress: (pct: number) => void) {
  return new Promise<{ public_id: string; width: number; height: number }>((resolve, reject) => {
    const form = new FormData();
    form.append("file", blob);
    form.append("api_key", sig.apiKey);
    form.append("timestamp", String(sig.timestamp));
    form.append("folder", sig.folder);
    form.append("signature", sig.signature);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", sig.endpoint);
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(JSON.parse(xhr.responseText))
        : reject(new Error(`cloudinary ${xhr.status}`));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(form);
  });
}

/**
 * The paperclip: pick a photo, shrink it, put it in Cloudinary, and hand the
 * parent back the id to send with the message.
 *
 * Uploading on pick rather than on send means the photo is already in place by
 * the time you finish typing the caption, and a failed upload is reported
 * while you can still just try another one.
 */
export function ImagePicker({
  onPicked,
  disabled,
}: {
  onPicked: (a: Attachment) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setPct(0);
    try {
      const { blob, width, height } = await downscale(file);
      const sig = await send<Signature>("/api/uploads/sign", "POST");
      const res = await upload(sig, blob, setPct);
      onPicked({
        publicId: res.public_id,
        width: res.width ?? width,
        height: res.height ?? height,
        previewUrl: URL.createObjectURL(blob),
      });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו להעלות את התמונה");
    } finally {
      setBusy(false);
      // Clear the input so picking the same file twice still fires a change.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        aria-label="לצרף תמונה"
        className={cn(
          "tap grid shrink-0 place-items-center rounded-xl px-3 text-white/55",
          "transition active:scale-95 disabled:opacity-30",
        )}
      >
        {!busy ? (
          <ImagePlus className="size-4" />
        ) : pct > 0 && pct < 100 ? (
          <span className="text-[10px] font-bold tabular-nums">{pct}%</span>
        ) : (
          <Loader2 className="size-4 animate-spin" />
        )}
      </button>
    </>
  );
}

/** The thumbnail that sits above the composer until the message is sent. */
export function AttachmentPreview({
  attachment,
  onClear,
}: {
  attachment: Attachment;
  onClear: () => void;
}) {
  // The object URL is held by the browser until it is handed back.
  useEffect(() => () => URL.revokeObjectURL(attachment.previewUrl), [attachment.previewUrl]);

  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="relative">
        <img
          src={attachment.previewUrl}
          alt="התמונה שתישלח"
          className="size-14 rounded-xl object-cover ring-1 ring-white/15"
        />
        <button
          type="button"
          onClick={onClear}
          aria-label="להסיר את התמונה"
          className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-white/15 bg-night-800 text-white/70 active:scale-90"
        >
          <X className="size-3" />
        </button>
      </div>
      <p className="text-[11px] text-white/40">התמונה תישלח עם ההודעה</p>
    </div>
  );
}
