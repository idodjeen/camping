"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useOverlay } from "@/lib/use-overlay";

import { Button } from "./button";

/**
 * The delete confirm pop-up, in place of the browser's confirm():
 *
 *   if (!(await confirmAction({ title: "למחוק את ההוצאה?", body: `"${name}", 640 ₪` }))) return;
 *
 * Name what goes in the body, and what else changes with it. Resolves false on
 * ביטול, the backdrop or Escape. Needs <ConfirmHost /> mounted, as <Toaster />
 * is; with none mounted it falls back to the browser's confirm().
 */
type Request = {
  title: string;
  body?: React.ReactNode;
  /** The destructive button's label. */
  action?: string;
};

const EVENT = "camping:confirm";
let hosts = 0;

export function confirmAction(request: Request): Promise<boolean> {
  if (hosts === 0) return Promise.resolve(window.confirm(request.title));
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { ...request, resolve } }));
  });
}

type Pending = Request & { resolve: (ok: boolean) => void };

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    hosts++;
    const onAsk = (e: Event) => {
      const next = (e as CustomEvent<Pending>).detail;
      // A second ask while one is open cancels the first rather than stacking.
      setPending((cur) => {
        cur?.resolve(false);
        return next;
      });
    };
    window.addEventListener(EVENT, onAsk);
    return () => {
      hosts--;
      window.removeEventListener(EVENT, onAsk);
    };
  }, []);

  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return <ConfirmDialog request={pending} onAnswer={answer} />;
}

function ConfirmDialog({ request, onAnswer }: { request: Request | null; onAnswer: (ok: boolean) => void }) {
  const open = request !== null;
  const mounted = useOverlay(open, () => onAnswer(false));
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Keep the last request on screen while the dialog fades out.
  const [shown, setShown] = useState<Request | null>(null);
  if (request && request !== shown) setShown(request);

  // Focus the safe choice, so Enter on a keyboard never deletes.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && shown && (
        <motion.div
          key="confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onAnswer(false)}
          className="fixed inset-0 z-[75] grid place-items-center bg-scrim px-7"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col items-center gap-2.5 rounded-[30px] bg-canvas px-[22px] pt-6 pb-[18px] text-center shadow-[0_20px_50px_var(--c-shadow)]"
          >
            <span aria-hidden className="grid size-14 place-items-center rounded-full bg-rose text-rose-ink">
              <Trash2 className="size-[26px]" />
            </span>
            <h2 id="confirm-title" className="font-display text-[22px]">
              {shown.title}
            </h2>
            {shown.body && <div className="text-[15px] leading-relaxed text-muted">{shown.body}</div>}
            <div className="mt-2 flex w-full gap-2">
              <Button ref={cancelRef} variant="secondary" full className="h-[50px] flex-1" onClick={() => onAnswer(false)}>
                ביטול
              </Button>
              <Button variant="danger" full className="h-[50px] flex-1" onClick={() => onAnswer(true)}>
                {shown.action ?? "מחיקה"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
