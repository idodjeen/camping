import { renderIcon } from "@/lib/pwa-icon";

const SIZES = [192, 512];

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const n = Number(size);
  if (!SIZES.includes(n)) return new Response("Not found", { status: 404 });
  return renderIcon(n);
}
