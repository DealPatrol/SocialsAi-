import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type GeneratedPost = {
  platform: string;
  content: string;
  hashtags: string[];
  mediaUrl?: string;
  characterCount: number;
};

export type Database = {
  public: {
    Tables: {
      drafts: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          source_type: 'url' | 'pdf' | 'youtube' | 'text';
          source_content: string;
          extracted_text: string;
          generated_posts: GeneratedPost[];
          status: 'draft' | 'published' | 'scheduled';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['drafts']['Row'], 'id' | 'created_at' | 'updated_at'>;
      };
      post_results: {
        Row: {
          id: string;
          draft_id: string;
          user_id: string;
          platforms: string[];
          ayrshare_result: Record<string, unknown>;
          scheduled_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['post_results']['Row'], 'id' | 'created_at'>;
      };
    };
  };
};
