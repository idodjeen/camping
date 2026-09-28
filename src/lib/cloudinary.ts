import { createHash } from "node:crypto";

import { HttpError } from "@/lib/session";

/**
 * Cloudinary, spoken directly over HTTP rather than through its SDK.
 *
 * The SDK is a large dependency for three calls, and everything else here
 * (push, mail, the database) is wired the same way — the thin thing that does
 * the job. The signing rule is Cloudinary's: sort the parameters by name, join
 * them as a query string, append the API secret, and SHA-1 the result.
 */

/** Every chat upload lands here, and nothing outside it is accepted back. */
export const CHAT_FOLDER = "camping/chat";

/**
 * A public id the server is willing to attach to a message.
 *
 * Cloudinary returns `<folder>/<name>`, and the browser is what hands it back,
 * so this is the boundary: without it a client could point a message at any
 * asset in the account — or at another account's, via a leading slash.
 */
const PUBLIC_ID = new RegExp(`^${CHAT_FOLDER}/[A-Za-z0-9_-]{1,120}$`);

export const isChatImageId = (id: string) => PUBLIC_ID.test(id);

function config() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpError(500, "העלאת תמונות עדיין לא הוגדרה בשרת");
  }
  return { cloudName, apiKey, apiSecret };
}

const sign = (params: Record<string, string | number>, apiSecret: string) =>
  createHash("sha1")
    .update(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join("&") + apiSecret,
    )
    .digest("hex");

/**
 * What the browser needs to upload straight to Cloudinary.
 *
 * Going direct rather than through a route handler keeps a multi-megabyte
 * photo out of a serverless function that caps request bodies at 4.5MB, and
 * stops the upload holding an invocation open for its whole duration.
 */
export function signUpload() {
  const { cloudName, apiKey, apiSecret } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder: CHAT_FOLDER, timestamp };

  return {
    cloudName,
    apiKey,
    timestamp,
    folder: CHAT_FOLDER,
    signature: sign(params, apiSecret),
    endpoint: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  };
}

/**
 * A delivery URL at a given width. `f_auto,q_auto` lets Cloudinary pick the
 * format and quality per browser, so old messages get WebP or AVIF without
 * anything being re-uploaded.
 */
export function imageUrl(publicId: string, width: number) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,c_limit,w_${width}/${publicId}`;
}

/** The two sizes a message needs: one for the bubble, one for the lightbox. */
export function imageViewOf(
  publicId: string | null,
  width: number | null,
  height: number | null,
) {
  if (!publicId) return null;
  const thumbUrl = imageUrl(publicId, 640);
  const url = imageUrl(publicId, 1600);
  if (!thumbUrl || !url) return null;
  return { thumbUrl, url, width, height };
}

export type ImageView = NonNullable<ReturnType<typeof imageViewOf>>;

/**
 * Drop an asset. Best-effort by design: the caller has already deleted the
 * message, and a Cloudinary hiccup must not turn that into a failed delete.
 */
export async function destroyImage(publicId: string) {
  const { cloudName, apiKey, apiSecret } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature: sign({ public_id: publicId, timestamp }, apiSecret),
  });

  await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body,
  });
}
