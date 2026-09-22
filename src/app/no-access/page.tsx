import { signOut } from "@/auth";

/**
 * Where Auth.js sends anyone it refuses (configured as `pages.error` in
 * auth.config.ts). The distinction matters for debugging: AccessDenied means
 * our allowlist rejected a real, valid sign-in, while Configuration means the
 * server is misconfigured and nobody can log in at all.
 */
const MESSAGES: Record<string, { title: string; body: React.ReactNode }> = {
  AccessDenied: {
    title: "אין גישה",
    body: (
      <>
        החשבון הזה לא ברשימת המשתתפים של מחנאות 2026.
        <br />
        אם זו טעות — דברו עם עידו.
      </>
    ),
  },
  Configuration: {
    title: "תקלה בהגדרות",
    body: (
      <>
        ההתחברות לא מוגדרת נכון בשרת.
        <br />
        זו תקלה שלנו, לא שלכם — דברו עם עידו.
      </>
    ),
  },
};

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const known = MESSAGES[error ?? "AccessDenied"] ?? MESSAGES.AccessDenied;
  const isConfig = error === "Configuration";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="glass w-full max-w-sm rounded-glass p-8 text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/80 to-orange-500/80 text-3xl">
          {isConfig ? "🛠️" : "🚫"}
        </div>

        <h1 className="text-2xl font-bold">{known.title}</h1>

        <p className="mt-3 text-sm leading-relaxed text-white/60">{known.body}</p>

        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="tap w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold transition active:scale-[0.98]"
          >
            חזרה למסך ההתחברות
          </button>
        </form>

        {/* The raw code, so a screenshot alone is enough to diagnose this. */}
        {error && (
          <p className="mt-5 font-mono text-[11px] tracking-wide text-white/25">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
