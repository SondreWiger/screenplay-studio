'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { Input, Card, Badge, toast } from '@/components/ui';
import { Icon } from '@/components/ui/icons';
import { EmptyState, PageHeader, Segmented, StatGrid, dailySpark } from '@/components/kit';
import { Palette, Plus } from 'lucide-react';
import { THEME_CATEGORIES, type ThemeCategory } from '@/lib/theme';
import { useThemeStore, useAuthStore } from '@/lib/stores';
import type { AppTheme } from '@/lib/theme';

interface ThemeRow {
  id: string;
  sha: string;
  name: string;
  description: string | null;
  category: string;
  colors: any;
  author_id: string | null;
  author_name: string | null;
  is_staff_pick: boolean;
  staff_pick_week: string | null;
  use_count: number;
  comment_count: number;
  created_at: string;
}

function ThemeCard({ theme }: { theme: ThemeRow }) {
  const c = theme.colors;
  const stripeColors = [c.bgBase, c.bgSurface, c.bgElevated, c.brand, c.scriptBg];

  return (
    <Link href={`/colors/${theme.id}`}>
      <div className="group rounded-xl border border-surface-700 bg-surface-900 overflow-hidden hover:border-surface-500 transition-all hover:scale-[1.01] cursor-pointer">
        {/* Color stripe */}
        <div className="flex h-8">
          {stripeColors.map((col: string, i: number) => (
            <div key={i} className="flex-1" style={{ background: col }} />
          ))}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold text-white group-hover:text-brand-400 transition-colors truncate">{theme.name}</h3>
            {theme.is_staff_pick && (
              <Badge variant="warning" size="sm">Staff Pick</Badge>
            )}
          </div>

          {theme.description && (
            <p className="text-xs text-surface-400 line-clamp-2 mb-3">{theme.description}</p>
          )}

          <div className="flex items-center justify-between text-[11px] text-surface-500">
            <span>by {theme.author_name || 'Anonymous'}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Icon name="arrowUp" size="sm" />
                {theme.use_count}
              </span>
              <span>{theme.category}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ColorsStorePage() {
  const router = useRouter();
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ThemeCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchColor, setSearchColor] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'staff_picks'>('popular');

  useEffect(() => {
    fetchThemes();
  }, []);

  const fetchThemes = async () => {
    try {
      const res = await fetch('/api/themes');
      if (res.ok) {
        const data = await res.json();
        setThemes(data.themes || []);
      }
    } catch (err) {
      console.error('Failed to fetch themes:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredThemes = useMemo(() => {
    let result = themes;

    // Category filter
    if (activeCategory !== 'all') {
      result = result.filter((t) => t.category === activeCategory);
    }

    // Search by name
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }

    // Search by color (hex proximity)
    if (searchColor) {
      result = result.filter((t) => {
        const colors = Object.values(t.colors) as string[];
        return colors.some((col) => col.toLowerCase().includes(searchColor.toLowerCase()));
      });
    }

    // Sort
    if (sortBy === 'popular') {
      result = [...result].sort((a, b) => b.use_count - a.use_count);
    } else if (sortBy === 'newest') {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'staff_picks') {
      result = result.filter((t) => t.is_staff_pick);
    }

    return result;
  }, [themes, activeCategory, searchQuery, searchColor, sortBy]);

  const staffPicks = themes.filter((t) => t.is_staff_pick).slice(0, 6);

  return (
    <div className="min-h-screen bg-surface-950">
      <AppHeader />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8">
        <div className="mb-6">
          <PageHeader
            icon={<Palette className="h-5 w-5" />}
            title="Theme Store"
            description="Browse community-created colour themes. Find the perfect look for your writing workspace."
            actions={
              <Link href="/settings?tab=appearance" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500">
                <Plus className="h-3.5 w-3.5" /> Create your own
              </Link>
            }
          />
        </div>

        {!loading && themes.length > 0 && (
          <div className="mb-8">
            <StatGrid
              cols={4}
              items={[
                { label: 'Themes', value: themes.length, tone: 'brand', spark: dailySpark(themes, (t) => t.created_at, 30) },
                { label: 'Staff picks', value: themes.filter((t) => t.is_staff_pick).length, tone: 'amber', onClick: () => setSortBy('staff_picks'), active: sortBy === 'staff_picks' },
                { label: 'Times applied', value: themes.reduce((n, t) => n + (t.use_count || 0), 0), tone: 'green' },
                { label: 'Creators', value: new Set(themes.map((t) => t.author_id).filter(Boolean)).size, tone: 'violet' },
              ]}
            />
          </div>
        )}

        {/* Staff Picks */}
        {staffPicks.length > 0 && sortBy !== 'staff_picks' && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="star" size="md" className="text-yellow-400" />
              <h2 className="text-lg font-semibold text-white">Staff Picks</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffPicks.map((theme) => (
                <ThemeCard key={theme.id} theme={theme} />
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search themes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon="search"
            />
          </div>
          <div className="w-32">
            <Input
              placeholder="#hex"
              value={searchColor}
              onChange={(e) => setSearchColor(e.target.value)}
              icon="palette"
            />
          </div>
          <Segmented
            id="theme-sort"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { key: 'popular', label: 'Popular' },
              { key: 'newest', label: 'Newest' },
              { key: 'staff_picks', label: 'Staff picks' },
            ]}
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {THEME_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Theme Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-surface-900 animate-pulse" />
            ))}
          </div>
        ) : filteredThemes.length === 0 ? (
          <EmptyState icon={<Palette className="h-8 w-8" />} title="No themes found" description="Try a different search or category." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredThemes.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
