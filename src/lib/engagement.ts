import { PRODUCT_CONTEXT } from "./strategy";

export type ContentTone = "informative" | "funny" | "serious" | "empathetic";

export const TONE_DESCRIPTIONS: Record<ContentTone, string> = {
  informative:
    "Teach something concrete — stats, steps, or a lesson devs can use today.",
  funny:
    "Light wit or self-deprecating dev humor — never punch down or mock individuals.",
  serious:
    "Direct, no fluff — stakes, tradeoffs, or honest builder reality.",
  empathetic:
    "Acknowledge struggle (burnout, dead repos, fear of shipping) then offer hope + insight.",
};

export function parseToneMix(json: string): ContentTone[] {
  try {
    const parsed = JSON.parse(json) as string[];
    const valid: ContentTone[] = [
      "informative",
      "funny",
      "serious",
      "empathetic",
    ];
    return parsed.filter((t): t is ContentTone =>
      valid.includes(t as ContentTone)
    );
  } catch {
    return ["informative", "funny", "serious", "empathetic"];
  }
}

export function pickNextTone(
  tones: ContentTone[],
  recentTones: ContentTone[] = []
): ContentTone {
  if (tones.length === 0) return "informative";
  const unused = tones.filter((t) => !recentTones.slice(-2).includes(t));
  const pool = unused.length > 0 ? unused : tones;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildEngagementSystemPrompt(
  productName: string,
  productDescription: string,
  tone: ContentTone
): string {
  return `You are an expert X (Twitter) growth strategist for ${productName}.

Product: ${productDescription}
Default product context: ${PRODUCT_CONTEXT.description}
Audience: indie hackers, solo devs, SaaS founders who might pay for repo intelligence tools.

Tone for this reply: ${tone} — ${TONE_DESCRIPTIONS[tone]}

Engagement rules (maximize reach WITHOUT violating X policies):
- Hook in the first 8 words — question, stat, or bold claim
- ALWAYS add genuine informational value (tip, data, framework, or lived experience)
- Never engagement-bait ("like if you agree", "RT for…")
- Never spam links — at most one link, only if deeply relevant
- No hashtag stuffing (0–1 hashtags max)
- Under 280 characters
- Sound human — contractions, specifics, no corporate speak
- Product mention only when natural (max 1 subtle mention per 5 replies)
- Vary structure: sometimes one-liner, sometimes 2 short sentences

Output ONLY the reply text. No quotes, labels, or explanations.`;
}

export function scoreEngagementPotential(text: string): number {
  let score = 50;
  if (text.length >= 80 && text.length <= 240) score += 15;
  if (/\d+/.test(text)) score += 10;
  if (/\?/.test(text)) score += 8;
  if (text.split("\n").length <= 2) score += 5;
  if (/(learned|found|built|shipped|repos?|saas|indie)/i.test(text))
    score += 12;
  if (text.length > 270) score -= 20;
  if ((text.match(/https?:\/\//g) ?? []).length > 1) score -= 15;
  return Math.min(100, Math.max(0, score));
}
