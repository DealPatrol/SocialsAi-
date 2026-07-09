import { getAnthropicClient } from "@/lib/anthropic";
import { validateDmContent } from "@/lib/x/compliance";
import { scoreEngagementPotential } from "@/lib/engagement";

export interface GeneratedDm {
  text: string;
  engagementScore: number;
  compliance: ReturnType<typeof validateDmContent>;
}

export async function generateWarmDm(
  username: string,
  warmContext: string,
  productContext: string,
  websiteUrl?: string
): Promise<GeneratedDm> {
  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: `You write warm, human X DMs that never feel like bots.

Rules (CRITICAL — account safety):
- Reference the specific public interaction (${warmContext})
- Conversational, 1-2 short sentences max
- NO "Hope this finds you well", NO sales pitch opener
- Product mention only if natural — max 1 subtle reference
- ${websiteUrl ? `Website only if they ask or it's truly relevant: ${websiteUrl}` : "No links unless essential"}
- Under 240 characters
- Sound like a real builder reaching out after a genuine exchange

Output ONLY the DM text.`,
    messages: [
      {
        role: "user",
        content: `Write a warm DM to @${username} after this public interaction:
"${warmContext}"

Product context (use lightly): ${productContext}`,
      },
    ],
  });

  let text =
    message.content[0].type === "text"
      ? message.content[0].text.trim()
      : "";
  text = text.replace(/^["']|["']$/g, "");

  const compliance = validateDmContent(text);
  return {
    text,
    compliance,
    engagementScore: scoreEngagementPotential(text),
  };
}
