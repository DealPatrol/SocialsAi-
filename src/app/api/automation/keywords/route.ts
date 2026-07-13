import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

// GET keywords for current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const userId = session.user.email || "unknown";

    const { data, error } = await supabase
      .from("niche_keywords")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ keywords: data });
  } catch (error) {
    console.error("[v0] Error fetching keywords:", error);
    return NextResponse.json(
      { error: "Failed to fetch keywords" },
      { status: 500 }
    );
  }
}

// POST add a new keyword
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { keyword, search_frequency } = await request.json();

    if (!keyword || !keyword.trim()) {
      return NextResponse.json(
        { error: "Keyword is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const userId = session.user.email || "unknown";

    const { data, error } = await supabase
      .from("niche_keywords")
      .insert([
        {
          user_id: userId,
          keyword: keyword.trim().toLowerCase(),
          search_frequency: search_frequency || "daily",
        },
      ])
      .select();

    if (error) {
      // If duplicate, return existing
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Keyword already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ keyword: data[0] }, { status: 201 });
  } catch (error) {
    console.error("[v0] Error adding keyword:", error);
    return NextResponse.json(
      { error: "Failed to add keyword" },
      { status: 500 }
    );
  }
}

// DELETE remove a keyword
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get("id");

    if (!keywordId) {
      return NextResponse.json(
        { error: "Keyword ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const userId = session.user.email || "unknown";

    const { error } = await supabase
      .from("niche_keywords")
      .delete()
      .eq("id", keywordId)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] Error deleting keyword:", error);
    return NextResponse.json(
      { error: "Failed to delete keyword" },
      { status: 500 }
    );
  }
}
