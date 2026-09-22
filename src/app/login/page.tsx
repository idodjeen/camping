import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="glass glow-brand w-full max-w-sm rounded-glass p-8 text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-aqua-400 text-3xl shadow-lg">
          🏕️
        </div>

        <h1 className="bg-gradient-to-l from-brand-300 via-ocean-400 to-aqua-300 bg-clip-text text-3xl font-bold text-transparent">
          מחנאות 2026
        </h1>
        <p className="mt-2 text-sm text-white/60">
          מי מביא מה, מה אוכלים, ומה עוד צריך לקנות.
        </p>

        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="tap flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3 font-semibold text-night-900 transition active:scale-[0.98]"
          >
            <GoogleMark />
            התחברות עם Google
          </button>
        </form>

        <p className="mt-6 text-xs text-white/40">
          הכניסה מוגבלת לחמשת החברים בטיול.
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75Z"
      />
    </svg>
  );
}
