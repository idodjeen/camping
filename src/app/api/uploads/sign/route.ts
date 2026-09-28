import { signUpload } from "@/lib/cloudinary";
import { handle, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * A short-lived signature for one direct-to-Cloudinary upload.
 *
 * POST rather than GET because it is not a cacheable read — each call mints a
 * fresh timestamp, and Cloudinary rejects a signature more than an hour old.
 * Being signed in is the whole authorization: the folder is fixed here, so a
 * signature cannot be steered at anything else in the account.
 */
export function POST() {
  return handle(async () => {
    await requireUser();
    return signUpload();
  });
}
