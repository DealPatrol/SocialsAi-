import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { text } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Tweet content required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const userId = session.user.id;

    // Add tweet to queue for immediate posting
    const { data, error } = await supabase
      .from("automation_queue")
      .insert({
        user_id: userId,
        tweet_content: text.trim(),
        scheduled_for: new Date().toISOString(),
        status: "pending",
      })
      .select();

    if (error) {
      console.error("[v0] Queue insert error:", error);
      return NextResponse.json(
        { error: "Failed to queue tweet" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      queueId: data[0]?.id,
      message: "Tweet added to automation queue for immediate posting",
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const userId = session.user.id;

    const { data, error } = await supabase
      .from("automation_queue")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[v0] Queue fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch queue" },
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
