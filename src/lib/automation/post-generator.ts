import { getAnthropicClient } from "@/lib/anthropic";
import {
  buildOriginalPostSystemPrompt,
  scoreEngagementPotential,
  type ContentTone,
} from "@/lib/engagement";
import { CONTENT_PILLARS, PRODUCT_CONTEXT, type PillarId } from "@/lib/strategy";
import {
  applyAutomationDisclosure,
  validatePostContent,
} from "@/lib/x/compliance";

export interface GeneratedPost {
  text: string;
  tone: ContentTone;
  pillarId: PillarId;
  pillarLabel: string;
  engagementScore: number;
  compliance: ReturnType<typeof validatePostContent>;
}

export function pickNextPillar(recentPillarIds: PillarId[] = []): (typeof CONTENT_PILLARS)[number] {
  const unused = CONTENT_PILLARS.filter(
    (p) => !recentPillarIds.slice(-3).includes(p.id)
  );
  const pool = unused.length > 0 ? unused : CONTENT_PILLARS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function generateOriginalPost(
  tone: ContentTone,
  pillar: (typeof CONTENT_PILLARS)[number],
  productContext?: string
): Promise<GeneratedPost> {
  const productName = PRODUCT_CONTEXT.name;
  const description = productContext ?? PRODUCT_CONTEXT.description;

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: buildOriginalPostSystemPrompt(productName, description, tone, pillar),
    messages: [
      {
        role: "user",
        content: `Write ONE original tweet for the "${pillar.label}" pillar.

Optional angle to weave in (if natural): a lesson from scanning GitHub repos for hidden product ideas.

Output only the tweet text.`,
      },
    ],
  });

  let text =
    message.content[0].type === "text"
      ? message.content[0].text.trim()
      : "";

  text = text.replace(/^["']|["']$/g, "");

  const compliance = validatePostContent(text);
  const engagementScore = scoreEngagementPotential(text);

  return {
    text,
    tone,
    pillarId: pillar.id,
    pillarLabel: pillar.label,
    engagementScore,
    compliance,
  };
}

export function finalizePost(
  draft: GeneratedPost,
  discloseAutomation: boolean
): GeneratedPost {
  const text = applyAutomationDisclosure(draft.text, discloseAutomation);
  const compliance = validatePostContent(text);
  return {
    ...draft,
    text,
    compliance,
    engagementScore: scoreEngagementPotential(text),
  };
}
