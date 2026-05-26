export const PRODUCT_CONTEXT = {
  name: "RepoFuse",
  tagline: "Turn scattered repos into product ideas",
  description:
    "A tool that scans your GitHub repositories and surfaces hidden product ideas, reusable code patterns, and monetization opportunities buried in your existing work.",
  audience: "indie hackers, solo devs, SaaS founders",
};

export const CONTENT_PILLARS = [
  {
    id: "build-in-public",
    label: "Build in Public",
    description: "Progress updates, shipping announcements, milestone reveals",
    examples: [
      "I just shipped X feature",
      "Week N of building RepoFuse",
      "Hit X users/signups today",
    ],
  },
  {
    id: "value-content",
    label: "Value Content / Threads",
    description:
      "Actionable tips, how-tos, and lessons from building the product",
    examples: [
      "How I turned scattered code into a product idea",
      "3 things I learned scanning 47 repos",
      "Why most devs have $X sitting in old repos",
    ],
  },
  {
    id: "dev-pain-points",
    label: "Developer Pain Points",
    description:
      "Relatable content about code graveyards, tech debt, unused repos",
    examples: [
      "You have 47 repos but nothing shipped",
      "The code graveyard problem",
      "Tech debt you didn't know was an asset",
    ],
  },
  {
    id: "real-examples",
    label: "Real Examples & Demos",
    description:
      "Concrete walkthroughs of ideas RepoFuse surfaced, especially the e-commerce example",
    examples: [
      "I ran RepoFuse on my repos and found this",
      "How one old project became a SaaS idea",
      "Before/after: from dead code to product pitch",
    ],
  },
  {
    id: "wins",
    label: "Wins & Social Proof",
    description:
      "User wins, revenue/usage milestones, positive reactions to share",
    examples: [
      "RepoFuse just helped a user find a $X idea",
      "User feedback that made my day",
      "X people have now scanned their repos",
    ],
  },
] as const;

export type PillarId = (typeof CONTENT_PILLARS)[number]["id"];

export const POST_FORMATS = [
  {
    id: "single-tweet",
    label: "Single Tweet",
    description: "Punchy standalone post, under 280 characters",
  },
  {
    id: "thread",
    label: "Thread (3–5 tweets)",
    description: "Multi-part thread that builds an argument or tells a story",
  },
  {
    id: "reply",
    label: "Strategic Reply",
    description:
      "Thoughtful reply to a big account that adds value and drives awareness",
  },
] as const;

export type FormatId = (typeof POST_FORMATS)[number]["id"];

export const TARGET_ACCOUNTS = [
  { handle: "@levelsio", niche: "indie hacking, building in public" },
  { handle: "@dvassallo", niche: "indie hacking, quitting big tech" },
  { handle: "@arvidkahl", niche: "bootstrapped SaaS, audience building" },
  { handle: "@shl", niche: "Gumroad, creator economy, indie founders" },
  { handle: "@thepatwalls", niche: "Makerpad, no-code, side projects" },
  { handle: "@marc_louvion", niche: "indie hacking, SaaS, building in public" },
];

export const VOICE_GUIDELINES = `
Write like a developer who is genuinely excited about what they're building, not a marketer.
- Direct and specific: use real numbers, real outcomes, real code references
- No buzzwords or hype ("game-changing", "revolutionary", "unleash")
- First person, conversational — like a tweet you'd actually send
- Hook in the first line: surprising stat, bold claim, relatable pain, or question
- End threads with a clear CTA (follow, reply, try the product)
- Replies should add a genuine insight or data point, never "Great post!"
`.trim();
