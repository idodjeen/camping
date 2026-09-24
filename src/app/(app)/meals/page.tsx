"use client";

import { Check } from "lucide-react";
import useSWR from "swr";

import { CommentsButton, TaggedBadge } from "@/components/comments";
import { CopyButton } from "@/components/copy-button";
import { PageTitle, SkeletonList } from "@/components/skeletons";
import { fetcher, swrConfig } from "@/lib/api";
import { SLOT_LABELS, formatTripDay } from "@/lib/dates";
import { formatMenu } from "@/lib/format-lists";
import { cn } from "@/lib/utils";

type Meal = {
  id: number;
  slot: "breakfast" | "lunch" | "dinner";
  title: string;
  description: string | null;
  items: { id: number; name: string; quantityText: string | null; isBought: boolean }[];
  commentCount: number;
  unreadMentions: number;
};
type Payload = { days: { date: string; meals: Meal[] }[] };

const SLOT_EMOJI = { breakfast: "☕️", lunch: "🔥", dinner: "🌙" } as const;

export default function MealsPage() {
  const { data, isLoading } = useSWR<Payload>("/api/meals", fetcher, swrConfig);

  if (isLoading && !data) {
    return (
      <>
        <PageTitle title="ארוחות" />
        <SkeletonList rows={5} />
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="ארוחות"
        subtitle="מה אוכלים, ומה צריך בשביל זה"
        action={<CopyButton getText={() => formatMenu(data?.days ?? [], formatTripDay)} />}
      />

      <div className="space-y-7">
        {data?.days.map((day) => (
          <section key={day.date}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-brand-300">
              {formatTripDay(day.date)}
            </h2>

            {/* Vertical rail ties the day's meals together as a timeline. */}
            <div className="relative space-y-3 border-e border-white/8 pe-4">
              {day.meals.map((meal) => (
                <div key={meal.id} className="relative">
                  <span className="absolute -end-[1.3rem] top-4 size-2 rounded-full bg-brand-400 ring-4 ring-night-950" />
                  <article
                    className={cn(
                      "glass rounded-2xl p-4 transition-colors",
                      // outline, not ring/border: `glass` sets both the border shorthand and
                      // box-shadow, so those utilities are silently overridden here.
                      meal.unreadMentions > 0 && "bg-brand-500/10 outline-2 outline-brand-400/50",
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span aria-hidden>{SLOT_EMOJI[meal.slot]}</span>
                      <h3 className="font-bold">{meal.title}</h3>
                      {meal.unreadMentions > 0 && <TaggedBadge />}
                      <span className="text-xs text-white/40">{SLOT_LABELS[meal.slot]}</span>
                      <span className="ms-auto">
                        <CommentsButton
                          subject="meal"
                          id={meal.id}
                          count={meal.commentCount}
                          name={meal.title}
                          unread={meal.unreadMentions}
                        />
                      </span>
                    </div>

                    {meal.description && (
                      <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                        {meal.description}
                      </p>
                    )}

                    {meal.items.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {meal.items.map((it) => (
                          <li
                            key={it.id}
                            className={cn(
                              "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition",
                              it.isBought
                                ? "bg-aqua-500/12 text-aqua-200"
                                : "bg-white/6 text-white/55",
                            )}
                          >
                            {it.isBought && <Check className="size-3" strokeWidth={3} />}
                            {it.name}
                            {it.quantityText && (
                              <span className="text-white/35">{it.quantityText}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
