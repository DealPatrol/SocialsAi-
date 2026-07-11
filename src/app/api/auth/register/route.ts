import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const { email, password, name } = await req.json();

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Email and password (8+ chars) required" },
        { status: 400 }
      );
    }

    const normalized = email.toLowerCase().trim();
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalized));

    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuid();

    await db.insert(users).values({
      id,
      email: normalized,
      passwordHash,
      name: name?.trim() || null,
    });

    return NextResponse.json({ ok: true, userId: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
