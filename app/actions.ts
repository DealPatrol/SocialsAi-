'use server';

import { auth } from '@clerk/nextjs/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { PLATFORM_CONFIGS } from '@/lib/openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function processContent(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const file = formData.get('file') as File | null;
  const url = formData.get('url') as string;
  const text = formData.get('text') as string;
  const selectedPlatforms = JSON.parse(formData.get('platforms') as string || '["x","instagram","linkedin"]') as string[];

  let extractedText = '';
  let sourceType: 'url' | 'pdf' | 'youtube' | 'text' = 'text';
  let sourceContent = '';

  try {
    if (file && file.type === 'application/pdf') {
      sourceType = 'pdf';
      sourceContent = file.name;
      const buffer = Buffer.from(await file.arrayBuffer());
      // @ts-ignore
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else if (url?.includes('youtube.com') || url?.includes('youtu.be')) {
      sourceType = 'youtube';
      sourceContent = url;
      try {
        const { YoutubeTranscript } = await import('youtube-transcript');
        const transcript = await YoutubeTranscript.fetchTranscript(url);
        extractedText = transcript.map((t: { text: string }) => t.text).join(' ');
      } catch {
        const res = await fetch(`https://r.jina.ai/${url}`);
        extractedText = await res.text();
      }
    } else if (url) {
      sourceType = 'url';
      sourceContent = url;
      const res = await fetch(`https://r.jina.ai/${url}`);
      extractedText = await res.text();
    } else if (text) {
      sourceType = 'text';
      sourceContent = text.substring(0, 100);
      extractedText = text;
    }

    if (!extractedText) throw new Error('No content could be extracted');

    const platformsConfig = selectedPlatforms
      .map(p => `${p.toUpperCase()} (max ${PLATFORM_CONFIGS[p as keyof typeof PLATFORM_CONFIGS]?.maxChars || 500} chars, ${PLATFORM_CONFIGS[p as keyof typeof PLATFORM_CONFIGS]?.style || 'engaging'})`)
      .join(', ');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: `You are a viral social media content expert. Generate platform-optimized posts from the provided content.
        
Return ONLY a valid JSON object with a "posts" array (no markdown, no explanation) with this exact structure:
{
  "posts": [
    {
      "platform": "x",
      "content": "Your post content here",
      "hashtags": ["hashtag1", "hashtag2"],
      "characterCount": 150
    }
  ]
}

Generate posts for these platforms: ${platformsConfig}

Rules:
- X/Twitter: Max 280 chars, punchy, 1-2 hashtags, strong hook
- Instagram: Visual, emojis, 20-30 relevant hashtags, engaging caption
- LinkedIn: Professional tone, story format, business insight, clear CTA
- Facebook: Conversational, relatable, ends with a question
- TikTok: Trendy hook first, viral format, trending hashtags
- YouTube: SEO-optimized, keyword-rich description
- Threads: Casual and authentic, like a tweet but more personal
- Bluesky: Similar to Twitter but more authentic community feel`
      }, {
        role: 'user',
        content: `Generate social media posts from this content:\n\n${extractedText.substring(0, 8000)}`
      }],
      response_format: { type: 'json_object' },
    });

    let generatedPosts: Array<{platform: string; content: string; hashtags: string[]; characterCount: number}> = [];
    try {
      const parsed = JSON.parse(completion.choices[0].message.content!);
      generatedPosts = Array.isArray(parsed) ? parsed : (parsed.posts || Object.values(parsed)[0] as typeof generatedPosts);
    } catch {
      generatedPosts = selectedPlatforms.map(p => ({
        platform: p,
        content: extractedText.substring(0, 280),
        hashtags: [],
        characterCount: Math.min(extractedText.length, 280)
      }));
    }

    const title = sourceContent.length > 50 ? sourceContent.substring(0, 50) + '...' : sourceContent || 'Untitled';
    const { data: draft, error } = await supabase
      .from('drafts')
      .insert({
        user_id: userId,
        title,
        source_type: sourceType,
        source_content: sourceContent,
        extracted_text: extractedText.substring(0, 10000),
        generated_posts: generatedPosts,
        status: 'draft'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return { posts: generatedPosts, draftId: null };
    }

    return { posts: generatedPosts, draftId: draft.id };
  } catch (error) {
    console.error('processContent error:', error);
    throw error;
  }
}

export async function crossPost(draftId: string, platforms: string[], postIndex = 0) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const { data: draft, error: draftError } = await supabase
    .from('drafts')
    .select('*')
    .eq('id', draftId)
    .eq('user_id', userId)
    .single();

  if (draftError || !draft) throw new Error('Draft not found');

  const selectedPost = draft.generated_posts[postIndex];
  if (!selectedPost) throw new Error('Post not found');

  const postContent = selectedPost.hashtags?.length > 0
    ? `${selectedPost.content}\n\n${selectedPost.hashtags.map((h: string) => `#${h}`).join(' ')}`
    : selectedPost.content;

  const response = await fetch('https://api.ayrshare.com/api/post', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post: postContent,
      platforms,
      mediaUrls: selectedPost.mediaUrls || [],
    }),
  });

  const result = await response.json();

  await supabase.from('post_results').insert({
    draft_id: draftId,
    user_id: userId,
    platforms,
    ayrshare_result: result,
    scheduled_at: null,
  });

  await supabase.from('drafts').update({ status: 'published' }).eq('id', draftId);

  return result;
}

export async function getDrafts() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteDraft(draftId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('drafts')
    .delete()
    .eq('id', draftId)
    .eq('user_id', userId);

  if (error) throw error;
  return { success: true };
}
