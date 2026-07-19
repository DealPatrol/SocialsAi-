import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

// GET discovered candidates
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "discovered";
    const minScore = parseInt(searchParams.get("minScore") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");

    const supabase = await createClient();
    const userId = session.user.email || "unknown";

    const query = supabase
      .from("user_discovery_candidates")
      .select("*")
      .eq("user_id", userId)
      .eq("status", status)
      .gte("engagement_score", minScore)
      .order("engagement_score", { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ candidates: data });
  } catch (error) {
    console.error("[v0] Error fetching candidates:", error);
    return NextResponse.json(
      { error: "Failed to fetch candidates" },
      { status: 500 }
    );
  }
}

// POST update candidate status
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const {
      candidateId,
      status,
      reason_skipped,
    } = await request.json();

    if (!candidateId || !status) {
      return NextResponse.json(
        { error: "Candidate ID and status are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const userId = session.user.email || "unknown";

    const updateData: {
      status: string;
      followed_at?: string;
      engaged_at?: string;
      reason_skipped?: string;
    } = { status };
    
    if (status === "followed") {
      updateData.followed_at = new Date().toISOString();
    } else if (status === "engaged") {
      updateData.engaged_at = new Date().toISOString();
    } else if (status === "skipped") {
      updateData.reason_skipped = reason_skipped;
    }

    const { data, error } = await supabase
      .from("user_discovery_candidates")
      .update(updateData)
      .eq("id", candidateId)
      .eq("user_id", userId)
      .select();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ candidate: data[0] });
  } catch (error) {
    console.error("[v0] Error updating candidate:", error);
    return NextResponse.json(
      { error: "Failed to update candidate" },
      { status: 500 }
    );
  }
}

// DELETE remove a candidate
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
    const candidateId = searchParams.get("id");

    if (!candidateId) {
      return NextResponse.json(
        { error: "Candidate ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const userId = session.user.email || "unknown";

    const { error } = await supabase
      .from("user_discovery_candidates")
      .delete()
      .eq("id", candidateId)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] Error deleting candidate:", error);
    return NextResponse.json(
      { error: "Failed to delete candidate" },
      { status: 500 }
    );
  }
}
