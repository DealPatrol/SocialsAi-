import { getAnthropicClient } from "@/lib/anthropic";
import { PRODUCT_CONTEXT } from "@/lib/strategy";

export interface OnboardingAnalysis {
  productContext: string;
  suggestedKeywords: string[];
  suggestedTopics: string;
}

export async function analyzeWebsiteAndTopics(
  websiteUrl: string,
  topics: string
): Promise<OnboardingAnalysis> {
  let pageHint = "";
  try {
    const res = await fetch(websiteUrl, {
      headers: { "User-Agent": "SocialsAI-Onboarding/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const html = await res.text();
      pageHint = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 3000);
    }
  } catch {
    pageHint = "";
  }

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: `You help configure X growth automation. Output JSON only.`,
    messages: [
      {
        role: "user",
        content: `Analyze this business for X growth targeting indie hackers / SaaS founders.

Website: ${websiteUrl}
User topics/niche: ${topics}
Page text sample: ${pageHint || "unavailable"}

Default product if sparse: ${PRODUCT_CONTEXT.description}

Return JSON:
{
  "productContext": "2-3 sentence description for AI to use when writing posts/replies",
  "suggestedKeywords": ["5-8 search keywords for finding target audience on X"],
  "suggestedTopics": "one line summary of niche"
}`,
      },
    ],
  });

  const raw =
    message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? "{}") as Partial<OnboardingAnalysis>;

  return {
    productContext:
      parsed.productContext ??
      `${PRODUCT_CONTEXT.name}: ${PRODUCT_CONTEXT.description}`,
    suggestedKeywords: parsed.suggestedKeywords ?? [
      "indie hacker",
      "saas founder",
      "build in public",
    ],
    suggestedTopics: parsed.suggestedTopics ?? topics,
  };
}
