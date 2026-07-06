'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDrafts, deleteDraft } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserButton } from '@clerk/nextjs';
import { Zap, Plus, Trash2, ExternalLink, FileText, Link as LinkIcon, Youtube, MessageSquare } from 'lucide-react';

type Draft = {
  id: string;
  title: string;
  source_type: string;
  status: string;
  created_at: string;
  generated_posts: Array<{ platform: string; content: string }>;
};

const sourceIcon = (type: string) => {
  if (type === 'pdf') return <FileText className="h-4 w-4" />;
  if (type === 'youtube') return <Youtube className="h-4 w-4" />;
  if (type === 'url') return <LinkIcon className="h-4 w-4" />;
  return <MessageSquare className="h-4 w-4" />;
};

const statusColor = (status: string) => {
  if (status === 'published') return 'bg-green-900/50 text-green-300 border-green-700';
  if (status === 'scheduled') return 'bg-blue-900/50 text-blue-300 border-blue-700';
  return 'bg-slate-800 text-slate-300 border-slate-700';
};

export default function DashboardPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    getDrafts()
      .then(setDrafts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteDraft(id);
      setDrafts(d => d.filter(x => x.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="border-b border-slate-800 bg-slate-950/80 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-400" />
            <span className="font-bold text-lg bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              SocialsAI
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/new">
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700 gap-1">
                <Plus className="h-4 w-4" /> New Post
              </Button>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Your Posts</h1>
            <p className="text-slate-400 text-sm mt-1">All your AI-generated content drafts</p>
          </div>
          <Link href="/new">
            <Button className="bg-violet-600 hover:bg-violet-700 gap-2">
              <Plus className="h-4 w-4" /> Create New Post
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-slate-900 border-slate-800 animate-pulse">
                <CardHeader><div className="h-5 bg-slate-800 rounded w-3/4" /></CardHeader>
                <CardContent><div className="h-4 bg-slate-800 rounded w-1/2" /></CardContent>
              </Card>
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-20">
            <Zap className="h-12 w-12 text-slate-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-400 mb-2">No posts yet</h2>
            <p className="text-slate-500 mb-6">Create your first AI-generated social post</p>
            <Link href="/new">
              <Button className="bg-violet-600 hover:bg-violet-700">
                <Plus className="h-4 w-4 mr-2" /> Create Your First Post
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {drafts.map(draft => (
              <Card key={draft.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium text-white line-clamp-2 flex items-center gap-2">
                      <span className="text-slate-400 flex-shrink-0">{sourceIcon(draft.source_type)}</span>
                      {draft.title}
                    </CardTitle>
                    <Badge className={`text-xs flex-shrink-0 ${statusColor(draft.status)}`}>
                      {draft.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {draft.generated_posts?.slice(0, 4).map(p => (
                      <Badge key={p.platform} variant="outline" className="text-xs border-slate-700 text-slate-400">
                        {p.platform}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(draft.created_at).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                      onClick={() => router.push(`/new?draft=${draft.id}`)}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-700 text-red-400 hover:bg-red-950 hover:border-red-800"
                      disabled={deleting === draft.id}
                      onClick={() => handleDelete(draft.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
