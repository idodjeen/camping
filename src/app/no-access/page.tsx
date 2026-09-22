import { signOut } from "@/auth";

/**
 * Where Auth.js sends anyone whose Google account is not in ALLOWED_USERS
 * (configured as `pages.error` in auth.config.ts).
 */
export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const isAccessDenied = error === "AccessDenied" || !error;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="glass w-full max-w-sm rounded-glass p-8 text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/80 to-orange-500/80 text-3xl">
          🚫
        </div>

        <h1 className="text-2xl font-bold">אין גישה</h1>

        <p className="mt-3 text-sm leading-relaxed text-white/60">
          {isAccessDenied ? (
            <>
              החשבון הזה לא ברשימת המשתתפים של מחנאות 2026.
              <br />
              אם זו טעות — דברו עם עידו.
            </>
          ) : (
            <>משהו השתבש בהתחברות. נסו שוב עוד רגע.</>
          )}
        </p>

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
      </div>
    </main>
  );
}
