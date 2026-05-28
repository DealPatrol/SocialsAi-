import { getAnthropicClient } from "@/lib/anthropic";
import {
  buildEngagementSystemPrompt,
  scoreEngagementPotential,
  type ContentTone,
} from "@/lib/engagement";
import { PRODUCT_CONTEXT } from "@/lib/strategy";
import {
  applyAutomationDisclosure,
  validateReplyContent,
} from "@/lib/x/compliance";
import type { TweetCandidate } from "@/lib/platforms/types";

export interface GeneratedReply {
  text: string;
  tone: ContentTone;
  engagementScore: number;
  compliance: ReturnType<typeof validateReplyContent>;
}

export async function generateStrategicReply(
  tweet: TweetCandidate,
  tone: ContentTone,
  productContext?: string
): Promise<GeneratedReply> {
  const productName = PRODUCT_CONTEXT.name;
  const description = productContext ?? PRODUCT_CONTEXT.description;

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: buildEngagementSystemPrompt(productName, description, tone),
    messages: [
      {
        role: "user",
        content: `Write ONE reply to this tweet from @${tweet.authorUsername}:

"${tweet.text}"

The reply must add real value for developers — not generic praise.`,
      },
    ],
  });

  let text =
    message.content[0].type === "text"
      ? message.content[0].text.trim()
      : "";

  text = text.replace(/^["']|["']$/g, "");

  const compliance = validateReplyContent(text);
  const engagementScore = scoreEngagementPotential(text);

  return { text, tone, engagementScore, compliance };
}

export function finalizeReply(
  draft: GeneratedReply,
  discloseAutomation: boolean
): GeneratedReply {
  let text = applyAutomationDisclosure(draft.text, discloseAutomation);
  const compliance = validateReplyContent(text);
  return {
    ...draft,
    text,
    compliance,
    engagementScore: scoreEngagementPotential(text),
  };
}
