"use client";

import { Bell, BookOpen, Check, Package, Plus, ShoppingCart, Trash2, Utensils, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { Modal } from "@/components/modal";
import { PageTitle, SkeletonList } from "@/components/skeletons";
import { Toaster, toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { confirmAction, ConfirmHost } from "@/components/ui/confirm";
import { CheckBox, Chip, ChipRow, Segmented, Switch, TextField } from "@/components/ui/controls";
import {
  Badge,
  Banner,
  Card,
  EmptyState,
  ErrorState,
  ItemRow,
  ListGroup,
  ListRow,
} from "@/components/ui/surfaces";

export function Gallery() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [chip, setChip] = useState("all");
  const [tab, setTab] = useState<"details" | "meals" | "categories">("details");
  const [on, setOn] = useState(true);
  const [packed, setPacked] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  // The theme script already chose one before paint; start the switch on it.
  useEffect(() => {
    if (document.documentElement.getAttribute("data-theme") === "dark") setTheme("dark");
  }, []);

  const pickTheme = (t: "light" | "dark") => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-7 px-5 py-6">
      <Toaster />
      <ConfirmHost />

      <PageTitle title="חלקי העיצוב" subtitle="כל החלקים המשותפים, בהיר וכהה" action={<CopyButton getText={() => "טקסט"} />} />

      <Segmented
        label="ערכת צבעים"
        value={theme}
        onChange={pickTheme}
        options={[
          { value: "light", label: "בהיר" },
          { value: "dark", label: "כהה" },
        ]}
      />

      <Section title="כפתורים">
        <Button full>שמירה</Button>
        <div className="flex flex-wrap gap-2.5">
          <Button size="sm" busy={busy} busyLabel="רושמים..." onClick={() => setBusy(true)}>
            אני מביא
          </Button>
          <Button size="sm" variant="secondary" disabled>
            שמירה
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setBusy(false)}>
            ביטול
          </Button>
          <Button size="xs" variant="soft" tone="peach" icon={<Plus className="size-[18px]" />}>
            הוצאה
          </Button>
          <Button size="sm" variant="danger">
            מחיקה
          </Button>
        </div>
      </Section>

      <Section title="צ׳יפים ובורר">
        <ChipRow className="mb-0">
          {[
            ["all", "הכל", 50],
            ["todo", "חסר", 6],
            ["mine", "אני מביא", 4],
            ["personal", "הרשימה שלי", 12],
          ].map(([key, label, count]) => (
            <Chip key={key} active={chip === key} count={count as number} onClick={() => setChip(key as string)}>
              {label}
            </Chip>
          ))}
          <Chip alert count={2}>
            תייגו אותך
          </Chip>
        </ChipRow>
        <Segmented
          label="ניהול הטיול"
          value={tab}
          onChange={setTab}
          options={[
            { value: "details", label: "פרטים" },
            { value: "meals", label: "ארוחות" },
            { value: "categories", label: "קטגוריות" },
          ]}
        />
      </Section>

      <Section title="שדות ומתגים">
        <TextField label="שם הטיול" defaultValue="סופ״ש בגליל" />
        <TextField label="שם המקום" optional placeholder="למשל: חניון בית צידה" hint="קואורדינטות או קישור מגוגל מפות" />
        <TextField label="תאריך" defaultValue="32.10" error="התאריך לא תקין" />
        <Card className="flex items-center gap-3 p-3.5">
          <span className="flex-1 text-[15px] font-bold">להזיז גם את הארוחות</span>
          <Switch checked={on} onChange={setOn} label="להזיז גם את הארוחות" />
        </Card>
        <Card className="flex items-center gap-2 py-1 ps-1 pe-3.5">
          <CheckBox checked={packed} onToggle={() => setPacked(!packed)} label="לסמן כארוז" />
          <span className={packed ? "text-muted line-through" : ""}>מברשת שיניים</span>
        </Card>
      </Section>

      <Section title="רשימות">
        <ListGroup title="בטיול">
          <ListRow href="/" icon={<ShoppingCart />} tone="sage" title="קניות" trailing={<Badge tone="rose">2 חסרים</Badge>} />
          <ListRow href="/" icon={<Utensils />} tone="amber" title="ארוחות" />
          <ListRow onClick={() => toast("נלחץ", "ok")} icon={<BookOpen />} tone="sage" title="המדריך הקצר" />
        </ListGroup>
        <ItemRow
          icon={<Package />}
          tone="rose"
          title="בלון גז"
          subtitle="נשאר 3 מתוך 4"
          action={
            <Button size="sm" onClick={() => toast("רשמנו אותך על בלון גז", "ok")}>
              אני מביא
            </Button>
          }
        />
        <div className="flex flex-wrap gap-2">
          <Badge>מנהל</Badge>
          <Badge tone="sage">אחראי קניות</Badge>
          <Badge tone="amber">צפייה בלבד</Badge>
        </div>
      </Section>

      <Section title="מצבים">
        <SkeletonList rows={2} />
        <EmptyState icon={<Check />} title="כל הציוד מכוסה" body="אין מה להביא. אפשר לבדוק מה עוד חסר בקניות" />
        <EmptyState
          icon={<Bell />}
          tone="amber"
          title="אין התראות עדיין"
          body="תיוגים, הודעות ופריטים שכוסו יופיעו כאן"
          action={
            <Button size="xs" variant="soft" icon={<Plus className="size-[18px]" />}>
              הוצאה
            </Button>
          }
        />
        <ErrorState icon={<WifiOff />} title="לא הצלחנו לטעון את הרשימה" body="בודקים חיבור ומנסים שוב" onRetry={() => toast("מנסים שוב", "ok")} />
        <Banner>צפייה בלבד - אפשר לראות הכול, אי אפשר לערוך</Banner>
      </Section>

      <Section title="הודעות וחלונות">
        <div className="flex flex-wrap gap-2.5">
          <Button size="sm" variant="secondary" onClick={() => toast("רשמנו אותך על בלון גז", "ok")}>
            הודעה טובה
          </Button>
          <Button size="sm" variant="secondary" onClick={() => toast("מישהו לקח את האחרון לפניך")}>
            הודעת שגיאה
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSheet(true)}>
            חלון מלמטה
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Trash2 className="size-[18px]" />}
            onClick={async () => {
              const ok = await confirmAction({
                title: "למחוק את ההוצאה?",
                body: '"סופר לפני היציאה", 640 ₪ ששילם ניר. היתרות של כולם יתעדכנו.',
              });
              toast(ok ? "נמחק" : "בוטל", ok ? "ok" : "error");
            }}
          >
            אישור מחיקה
          </Button>
        </div>
      </Section>

      <Modal open={sheet} onClose={() => setSheet(false)} title="הטיולים שלי">
        <div className="flex flex-col gap-2.5">
          <TextField label="שם" placeholder="כתבו כאן" />
          <Button full onClick={() => setSheet(false)}>
            שמירה
          </Button>
        </div>
      </Modal>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg">{title}</h2>
      {children}
    </section>
  );
}
