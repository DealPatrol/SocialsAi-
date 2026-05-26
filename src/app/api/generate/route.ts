import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import {
  PRODUCT_CONTEXT,
  CONTENT_PILLARS,
  VOICE_GUIDELINES,
  type PillarId,
  type FormatId,
} from "@/lib/strategy";

export interface GenerateRequest {
  format: FormatId;
  pillarId: PillarId;
  context: string;
  replyToTweet?: string;
}

export interface GenerateResponse {
  posts: string[];
  pillar: string;
  format: string;
}

function buildSystemPrompt(): string {
  return `You are a social media copywriter for ${PRODUCT_CONTEXT.name} (${PRODUCT_CONTEXT.tagline}).

Product: ${PRODUCT_CONTEXT.description}
Target audience: ${PRODUCT_CONTEXT.audience}

Voice guidelines:
${VOICE_GUIDELINES}

Content pillars:
${CONTENT_PILLARS.map((p) => `- ${p.label}: ${p.description}`).join("\n")}

Always output only the tweet text(s), no explanations or meta-commentary.
For threads, separate each tweet with "---" on its own line.
For single tweets, output just the tweet text.
For replies, output just the reply text (under 280 characters).`;
}

function buildUserPrompt(req: GenerateRequest): string {
  const pillar = CONTENT_PILLARS.find((p) => p.id === req.pillarId);

  if (req.format === "reply" && req.replyToTweet) {
    return `Generate 3 alternative strategic replies to this tweet from a big account.

Tweet to reply to:
"${req.replyToTweet}"

Context from my side (use this to craft the reply):
${req.context}

Content pillar to draw from: ${pillar?.label} — ${pillar?.description}

Rules:
- Each reply must genuinely add value (insight, data point, experience)
- Never just validate ("Great point!") — add something
- Weave in ${PRODUCT_CONTEXT.name} naturally only if it fits; don't force it
- Under 280 characters each
- Separate alternatives with "---"`;
  }

  if (req.format === "thread") {
    return `Write a Twitter thread (4–5 tweets) for the "${pillar?.label}" content pillar.

Context / what I want to share:
${req.context}

Structure:
- Tweet 1: Strong hook (surprising stat, bold claim, or relatable pain)
- Tweets 2–4: Body — deliver the value, use concrete examples
- Tweet 5: CTA — follow for more, reply with your experience, or try ${PRODUCT_CONTEXT.name}

Separate tweets with "---"`;
  }

  return `Write 3 alternative single tweets for the "${pillar?.label}" content pillar.

Context / what I want to share:
${req.context}

Rules:
- Each under 280 characters
- Strong hook in first line
- Specific and concrete, no vague claims
- Separate alternatives with "---"`;
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();

    if (!body.format || !body.pillarId || !body.context?.trim()) {
      return NextResponse.json(
        { error: "format, pillarId, and context are required" },
        { status: 400 }
      );
    }

    const client = getAnthropicClient();
    const pillar = CONTENT_PILLARS.find((p) => p.id === body.pillarId);

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(body) }],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text : "";

    const posts = raw
      .split("---")
      .map((p) => p.trim())
      .filter(Boolean);

    return NextResponse.json({
      posts,
      pillar: pillar?.label ?? body.pillarId,
      format: body.format,
    } satisfies GenerateResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
