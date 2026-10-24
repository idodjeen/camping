"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/surfaces";

/**
 * What error.tsx and global-error.tsx both show: retry first, since a failed
 * fetch often works the second time, and a full reload for when this tab is
 * running an old bundle.
 */
export function ErrorCard({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="flex w-full flex-col items-center gap-2 p-6 text-center">
      <span aria-hidden className="mb-1 grid size-[52px] place-items-center rounded-full bg-rose text-rose-ink">
        <TriangleAlert className="size-6" />
      </span>
      <h1 className="font-display text-[22px]">משהו השתבש</h1>
      <p className="text-sm leading-relaxed text-muted">
        המסך הזה לא נטען. אפשר לנסות שוב, ואם זה לא עוזר, לרענן את האפליקציה.
      </p>
      <div className="mt-3 flex w-full flex-col gap-2.5">
        <Button full icon={<RotateCw className="size-[18px]" />} onClick={() => retry()}>
          לנסות שוב
        </Button>
        <Button variant="secondary" full onClick={() => window.location.reload()}>
          לרענן את האפליקציה
        </Button>
      </div>
      {/* Server errors reach the client as a digest only; it matches the Vercel log line. */}
      {error.digest && (
        <p className="mt-3 font-mono text-[13px] tracking-wide text-muted" dir="ltr">
          {error.digest}
        </p>
      )}
    </Card>
  );
}
