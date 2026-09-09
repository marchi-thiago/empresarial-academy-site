import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { syncCampaignMetricsDaily } from "@/lib/google-ads";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const key = url.searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const dry = url.searchParams.get("dry") === "1";

  const payload = await getPayloadClient();
  const result = await syncCampaignMetricsDaily(payload, { dry });
  return NextResponse.json(result);
}
