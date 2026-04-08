import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const PLATFORM_CONFIGS = {
  x: { maxChars: 280, style: 'punchy and concise', format: 'short tweet with 1-2 hashtags' },
  instagram: { maxChars: 2200, style: 'visual and engaging with emojis', format: 'caption + 20-30 hashtags' },
  linkedin: { maxChars: 3000, style: 'professional and insightful', format: 'story format with CTA' },
  facebook: { maxChars: 63206, style: 'conversational and relatable', format: 'paragraph with question' },
  tiktok: { maxChars: 2200, style: 'trendy hook + CTA', format: 'short hook + description + hashtags' },
  youtube: { maxChars: 5000, style: 'SEO-optimized description', format: 'title hook + description + tags' },
  threads: { maxChars: 500, style: 'conversational', format: 'short thought with 1-2 hashtags' },
  bluesky: { maxChars: 300, style: 'engaging and authentic', format: 'short post with optional hashtag' },
};
