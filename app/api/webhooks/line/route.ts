import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { handleLineEvent } from "@/lib/integrations/line-bot";
import { verifyLineSignature } from "@/lib/integrations/security";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!verifyLineSignature(body, request.headers.get("x-line-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const payload = JSON.parse(body) as { events?: Array<Parameters<typeof handleLineEvent>[0]> };
    for (const event of payload.events ?? []) {
      await handleLineEvent(event);
      if (event.type === "message") {
        revalidatePath("/protected/inbox");
        revalidatePath("/protected/tasks");
        revalidatePath("/protected/calendar");
        revalidatePath("/protected");
        revalidatePath("/protected/settings");
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
