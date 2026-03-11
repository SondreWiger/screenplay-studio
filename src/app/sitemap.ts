import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

// Regenerate sitemap on each request (includes dynamic DB content)
export const dynamic = 'force-dynamic';

// Use a plain Supabase client (no cookies) — sitemap runs at build time with no request context
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/pro`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/community`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/community/showcase`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/community/challenges`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/community/free-scripts`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/community/share`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE_URL}/support`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },

    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/changelog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/sitemap-visual`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    // Legal pages
    { url: `${BASE_URL}/legal`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/legal/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/legal/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/legal/cookies`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/legal/dmca`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/legal/acceptable-use`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/legal/data-processing`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/legal/copyright`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/legal/security`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/legal/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE_URL}/legal/content-policy`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/legal/community-guidelines`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  // Dynamic public showcase pages — fetch from DB
  let showcasePages: MetadataRoute.Sitemap = [];
  try {
    const supabase = getSupabase();
    const { data: projects } = await supabase
      .from('projects')
      .select('id, updated_at')
      .eq('is_showcased', true)
      .order('updated_at', { ascending: false })
      .limit(500);

    if (projects) {
      showcasePages = projects.map(p => ({
        url: `${BASE_URL}/community/showcase/${p.id}`,
        lastModified: p.updated_at,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }
  } catch {
    // Silently fail — sitemap still works without dynamic pages
  }

  // Public user profiles
  let profilePages: MetadataRoute.Sitemap = [];
  try {
    const supabase = getSupabase();
    const { data: profiles } = await supabase
      .from('profiles')
      .select('username, updated_at')
      .not('username', 'is', null)
      .eq('show_projects', true)
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (profiles) {
      profilePages = profiles.map(p => ({
        url: `${BASE_URL}/u/${p.username}`,
        lastModified: p.updated_at,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }));
    }
  } catch {}

  // Blog posts
  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const supabase = getSupabase();
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(500);

    if (posts) {
      blogPages = [
        ...posts.map(p => ({
          url: `${BASE_URL}/blog/${p.slug}`,
          lastModified: p.updated_at,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        })),
      ];
    }
  } catch {}

  // Legal blog posts
  let legalBlogPages: MetadataRoute.Sitemap = [];
  try {
    const supabase = getSupabase();
    const { data: posts } = await supabase
      .from('legal_posts')
      .select('slug, updated_at')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(100);

    if (posts) {
      legalBlogPages = posts.map(p => ({
        url: `${BASE_URL}/legal/blog/${p.slug}`,
        lastModified: p.updated_at,
        changeFrequency: 'monthly' as const,
        priority: 0.4,
      }));
    }
  } catch {}

  return [...staticPages, ...showcasePages, ...profilePages, ...blogPages, ...legalBlogPages];
}
