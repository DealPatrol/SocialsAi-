import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { persistTokensFromJwt } from "@/lib/x-accounts";
import {
  createAdminClient,
  isSupabaseAdminConfigured,
} from "@/utils/supabase/admin";

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isSupabaseAdminConfigured()) {
    return {
      error: NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 }
      ),
    };
  }
  return { userId: session.user.id, supabase: createAdminClient() };
}

async function nextScheduledFor(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<string> {
  const { data: settings } = await supabase
    .from("automation_settings")
    .select("post_interval_hours")
    .eq("user_id", userId)
    .maybeSingle<{ post_interval_hours: number | null }>();

  const intervalHours = Math.max(settings?.post_interval_hours ?? 3, 2);
  const { data: latest } = await supabase
    .from("automation_queue")
    .select("scheduled_for")
    .eq("user_id", userId)
    .in("status", ["pending", "posted"])
    .order("scheduled_for", { ascending: false })
    .limit(1)
    .maybeSingle<{ scheduled_for: string }>();

  const last = latest?.scheduled_for
    ? new Date(latest.scheduled_for).getTime()
    : 0;
  const slot = Math.max(Date.now(), last + intervalHours * 60 * 60 * 1000);
  return new Date(slot).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const token = await getToken({ req });
    await persistTokensFromJwt(token);

    const { text } = await req.json();
    if (!text || !String(text).trim()) {
      return NextResponse.json(
        { error: "Tweet content required" },
        { status: 400 }
      );
    }

    const scheduledFor = await nextScheduledFor(auth.supabase, auth.userId);
    const { data, error } = await auth.supabase
      .from("automation_queue")
      .insert({
        user_id: auth.userId,
        tweet_content: String(text).trim(),
        scheduled_for: scheduledFor,
        status: "pending",
      })
      .select("id, scheduled_for")
      .single();

    if (error) {
      console.error("[v0] Queue insert error:", error);
      return NextResponse.json(
        { error: "Failed to queue tweet", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      queueId: data.id,
      scheduledFor: data.scheduled_for,
      message: "Tweet added to the Auto Post queue",
    });
  } catch (error) {
    console.error("[v0] Queue API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.supabase
      .from("automation_queue")
      .select(
        "id, tweet_content, scheduled_for, posted_at, status, error_message, posted_tweet_id, created_at"
      )
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[v0] Queue fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch queue", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ queue: data });
  } catch (error) {
    console.error("[v0] Queue API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;
    const id = typeof body.id === "string" ? body.id : undefined;

    if (action !== "retry" && action !== "retry-failed") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    let query = auth.supabase
      .from("automation_queue")
      .update({
        status: "pending",
        error_message: null,
        scheduled_for: new Date().toISOString(),
      })
      .eq("user_id", auth.userId)
      .eq("status", "failed");

    if (action === "retry" && id) {
      query = query.eq("id", id);
    }

    const { data, error } = await query.select("id");

    if (error) {
      console.error("[v0] Queue retry error:", error);
      return NextResponse.json(
        { error: "Failed to retry posts", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      retried: data?.length ?? 0,
    });
  } catch (error) {
    console.error("[v0] Queue API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
