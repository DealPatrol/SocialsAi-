import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const userId = session.user.id || session.user.email;

    // Get or create settings
    let { data: settings, error } = await supabase
      .from("automation_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !settings) {
      // Create default settings
      const { data: newSettings, error: insertError } = await supabase
        .from("automation_settings")
        .insert({
          user_id: userId,
          auto_post_enabled: false,
          auto_follow_enabled: false,
          auto_like_enabled: false,
          auto_dm_enabled: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[v0] Settings creation error:", insertError);
        return NextResponse.json(
          { error: "Failed to create settings" },
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const updates = await request.json();
    const supabase = await createClient();
    const userId = session.user.id || session.user.email;

    const { data, error } = await supabase
      .from("automation_settings")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("[v0] Settings update error:", error);
      return NextResponse.json(
        { error: "Failed to update settings" },
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
