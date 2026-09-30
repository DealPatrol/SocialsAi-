import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { persistTokensFromJwt } from "@/lib/x-accounts";
import {
  createAdminClient,
  isSupabaseAdminConfigured,
} from "@/utils/supabase/admin";

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const token = await getToken({ req: request });
    await persistTokensFromJwt(token);

    const { data, error: fetchError } = await auth.supabase
      .from("automation_settings")
      .select("*")
      .eq("user_id", auth.userId)
      .maybeSingle();

    let settings = data;

    if (fetchError) {
      console.error("[v0] Settings fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to load settings", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!settings) {
      const { data: newSettings, error: insertError } = await auth.supabase
        .from("automation_settings")
        .insert({
          user_id: auth.userId,
          auto_post_enabled: false,
          suggestions_enabled: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[v0] Settings creation error:", insertError);
        return NextResponse.json(
          { error: "Failed to create settings", details: insertError.message },
          { status: 500 }
        );
      }

      settings = newSettings;
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[v0] Settings API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const updates = await request.json();
    const payload = {
      auto_post_enabled: Boolean(updates.auto_post_enabled),
      suggestions_enabled: Boolean(updates.suggestions_enabled),
      post_interval_hours: clamp(
        Number(updates.post_interval_hours),
        2,
        24,
        3
      ),
      max_suggestions_per_day: clamp(
        Number(updates.max_suggestions_per_day),
        1,
        20,
        5
      ),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await auth.supabase
      .from("automation_settings")
      .upsert(
        { user_id: auth.userId, ...payload },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("[v0] Settings update error:", error);
      return NextResponse.json(
        { error: "Failed to update settings", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings: data });
  } catch (error) {
    console.error("[v0] Settings API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
