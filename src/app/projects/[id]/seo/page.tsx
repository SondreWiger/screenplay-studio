'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Button, Badge, Input, Textarea, Select, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { VideoSEO, VideoChapter, Thumbnail } from '@/lib/types';

const YOUTUBE_CATEGORIES = [
  { value: '', label: 'Select category' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'education', label: 'Education' },
  { value: 'howto', label: 'How-to & Style' },
  { value: 'science', label: 'Science & Technology' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'music', label: 'Music' },
  { value: 'news', label: 'News & Politics' },
  { value: 'sports', label: 'Sports' },
  { value: 'travel', label: 'Travel & Events' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'film', label: 'Film & Animation' },
  { value: 'people', label: 'People & Blogs' },
];

// ============================================================
// SEO Score Calculator - VidIQ-style scoring
// ============================================================
interface SEOCheck {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  tip: string;
  category: 'title' | 'description' | 'tags' | 'engagement' | 'metadata';
}

function calculateSEOScore(
  seo: VideoSEO | null, 
  chapters: VideoChapter[], 
  hasThumbnail: boolean
): { score: number; grade: string; color: string; checks: SEOCheck[] } {
  const checks: SEOCheck[] = [];
  
  const titleLen = seo?.video_title?.length || 0;
  const descLen = seo?.video_description?.length || 0;
  const tagsCount = seo?.tags?.length || 0;
  const keywordsCount = seo?.target_keywords?.length || 0;
  const hashtagsCount = seo?.hashtags?.length || 0;
  
  // Title checks (25 points max)
  checks.push({
    id: 'title_exists', label: 'Has title', weight: 5,
    passed: titleLen > 0,
    tip: 'Add a compelling video title',
    category: 'title',
  });
  checks.push({
    id: 'title_length', label: 'Title 40-60 chars (optimal)', weight: 10,
    passed: titleLen >= 40 && titleLen <= 60,
    tip: 'Keep title between 40-60 characters for best display',
    category: 'title',
  });
  checks.push({
    id: 'title_not_too_long', label: 'Title under 100 chars', weight: 5,
    passed: titleLen > 0 && titleLen <= 100,
    tip: 'Titles over 100 chars get cut off',
    category: 'title',
  });
  checks.push({
    id: 'title_has_keyword', label: 'Title contains keyword', weight: 5,
    passed: keywordsCount > 0 && seo?.target_keywords?.some(kw => 
      seo?.video_title?.toLowerCase().includes(kw.toLowerCase())
    ) || false,
    tip: 'Include your main keyword in the title',
    category: 'title',
  });

  // Description checks (25 points max)
  checks.push({
    id: 'desc_exists', label: 'Has description', weight: 5,
    passed: descLen > 0,
    tip: 'Add a detailed video description',
    category: 'description',
  });
  checks.push({
    id: 'desc_length_min', label: 'Description 200+ chars', weight: 5,
    passed: descLen >= 200,
    tip: 'Write at least 200 characters in your description',
    category: 'description',
  });
  checks.push({
    id: 'desc_length_good', label: 'Description 500+ chars', weight: 5,
    passed: descLen >= 500,
    tip: 'Longer descriptions (500+) help with SEO',
    category: 'description',
  });
  checks.push({
    id: 'desc_has_keyword', label: 'Description contains keywords', weight: 5,
    passed: keywordsCount > 0 && seo?.target_keywords?.some(kw => 
      seo?.video_description?.toLowerCase().includes(kw.toLowerCase())
    ) || false,
    tip: 'Include keywords naturally in your description',
    category: 'description',
  });
  checks.push({
    id: 'desc_has_hashtags', label: 'Description has hashtags', weight: 5,
    passed: hashtagsCount >= 3 || (seo?.video_description?.match(/#\w+/g)?.length || 0) >= 3,
    tip: 'Add 3-5 hashtags to your description',
    category: 'description',
  });

  // Tags checks (20 points max)
  checks.push({
    id: 'has_tags', label: 'Has tags', weight: 5,
    passed: tagsCount > 0,
    tip: 'Add relevant tags to help discovery',
    category: 'tags',
  });
  checks.push({
    id: 'tags_count', label: '5-15 tags added', weight: 10,
    passed: tagsCount >= 5 && tagsCount <= 15,
    tip: 'Use 5-15 relevant tags for optimal reach',
    category: 'tags',
  });
  checks.push({
    id: 'has_keywords', label: 'Target keywords defined', weight: 5,
    passed: keywordsCount >= 1,
    tip: 'Define at least 1-3 target keywords',
    category: 'tags',
  });

  // Engagement checks (15 points max)
  checks.push({
    id: 'has_chapters', label: 'Has chapters/timestamps', weight: 5,
    passed: chapters.length >= 3,
    tip: 'Add at least 3 chapters to help navigation',
    category: 'engagement',
  });
  checks.push({
    id: 'has_thumbnail', label: 'Has custom thumbnail', weight: 10,
    passed: hasThumbnail,
    tip: 'Upload a custom thumbnail in the Thumbnails tab',
    category: 'engagement',
  });

  // Metadata checks (15 points max)
  checks.push({
    id: 'has_category', label: 'Category selected', weight: 5,
    passed: !!seo?.category,
    tip: 'Select a video category',
    category: 'metadata',
  });
  checks.push({
    id: 'visibility_set', label: 'Visibility configured', weight: 5,
    passed: !!seo?.visibility && seo.visibility !== 'private',
    tip: 'Set video visibility to public or unlisted',
    category: 'metadata',
  });
  checks.push({
    id: 'kids_setting', label: 'Made for kids setting', weight: 5,
    passed: seo?.made_for_kids !== undefined,
    tip: 'Confirm if video is made for kids or not',
    category: 'metadata',
  });

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earnedWeight = checks.filter(c => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);
  
  let grade = 'F';
  let color = 'text-red-500';
  if (score >= 90) { grade = 'A+'; color = 'text-green-400'; }
  else if (score >= 80) { grade = 'A'; color = 'text-green-500'; }
  else if (score >= 70) { grade = 'B'; color = 'text-lime-500'; }
  else if (score >= 60) { grade = 'C'; color = 'text-yellow-500'; }
  else if (score >= 50) { grade = 'D'; color = 'text-orange-500'; }

  return { score, grade, color, checks };
}

export default function SEOPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { members, currentProject } = useProjectStore();
  const { user } = useAuthStore();
  
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  const [seo, setSeo] = useState<VideoSEO | null>(null);
  const [chapters, setChapters] = useState<VideoChapter[]>([]);
  const [hasThumbnail, setHasThumbnail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [showScoreDetails, setShowScoreDetails] = useState(false);

  // Calculate SEO score
  const seoResult = useMemo(() => 
    calculateSEOScore(seo, chapters, hasThumbnail),
    [seo, chapters, hasThumbnail]
  );

  // Group checks by category for display (must be before loading check)
  const checksByCategory = useMemo(() => {
    const grouped: Record<string, SEOCheck[]> = { title: [], description: [], tags: [], engagement: [], metadata: [] };
    seoResult.checks.forEach(c => grouped[c.category].push(c));
    return grouped;
  }, [seoResult.checks]);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    const supabase = createClient();
    const [{ data: seoData }, { data: chaptersData }, { data: thumbData }] = await Promise.all([
      supabase.from('video_seo').select('*').eq('project_id', projectId).single(),
      supabase.from('video_chapters').select('*').eq('project_id', projectId).order('timestamp'),
      supabase.from('thumbnails').select('id').eq('project_id', projectId).limit(1),
    ]);
    
    // Create SEO record if it doesn't exist
    if (!seoData) {
      const { data: newSeo, error: seoError } = await supabase
        .from('video_seo')
        .insert({
          project_id: projectId,
          video_title: currentProject?.title || '',
          video_description: currentProject?.logline || '',
        })
        .select()
        .single();
      if (seoError) { toast.error('Failed to create SEO record'); setLoading(false); return; }
      setSeo(newSeo);
    } else {
      setSeo(seoData);
    }
    
    setChapters(chaptersData || []);
    setHasThumbnail((thumbData?.length || 0) > 0);
    setLoading(false);
  };

  const updateSeo = async (updates: Partial<VideoSEO>) => {
    if (!seo) return;
    setSaving(true);
    
    const supabase = createClient();
    await supabase
      .from('video_seo')
      .update(updates)
      .eq('id', seo.id);
    
    setSeo({ ...seo, ...updates });
    setSaving(false);
  };

  const addTag = () => {
    if (!tagInput.trim() || !seo) return;
    const newTags = [...(seo.tags || []), tagInput.trim()];
    updateSeo({ tags: newTags });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    if (!seo) return;
    updateSeo({ tags: seo.tags.filter(t => t !== tag) });
  };

  const addHashtag = () => {
    if (!hashtagInput.trim() || !seo) return;
    const formatted = hashtagInput.startsWith('#') ? hashtagInput : `#${hashtagInput}`;
    const newHashtags = [...(seo.hashtags || []), formatted.trim()];
    updateSeo({ hashtags: newHashtags });
    setHashtagInput('');
  };

  const removeHashtag = (tag: string) => {
    if (!seo) return;
    updateSeo({ hashtags: seo.hashtags.filter(t => t !== tag) });
  };

  const addKeyword = () => {
    if (!keywordInput.trim() || !seo) return;
    const newKeywords = [...(seo.target_keywords || []), keywordInput.trim()];
    updateSeo({ target_keywords: newKeywords });
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    if (!seo) return;
    updateSeo({ target_keywords: seo.target_keywords.filter(k => k !== kw) });
  };

  // Chapters
  const addChapter = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('video_chapters')
      .insert({
        project_id: projectId,
        title: 'New Chapter',
        timestamp: 0,
        sort_order: chapters.length,
      })
      .select()
      .single();
    
    if (error) { toast.error('Failed to add chapter'); return; }
    if (data) {
      setChapters([...chapters, data]);
    }
  };

  const updateChapter = async (id: string, updates: Partial<VideoChapter>) => {
    const supabase = createClient();
    await supabase.from('video_chapters').update(updates).eq('id', id);
    setChapters(chapters.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteChapter = async (id: string) => {
    const supabase = createClient();
    await supabase.from('video_chapters').delete().eq('id', id);
    setChapters(chapters.filter(c => c.id !== id));
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateChaptersText = () => {
    return chapters
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(c => `${formatTimestamp(c.timestamp)} ${c.title}`)
      .join('\n');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[#FF5F1F] border-t-transparent rounded-full" />
      </div>
    );
  }

  const titleLength = seo?.video_title?.length || 0;
  const descLength = seo?.video_description?.length || 0;

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* SEO Score Card */}
      <div className="bg-gradient-to-br from-surface-900 to-surface-800 border border-surface-700 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Score Circle */}
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 transform -rotate-90">
                <circle cx="56" cy="56" r="48" fill="none" stroke="currentColor" strokeWidth="8" 
                  className="text-surface-700" />
                <circle cx="56" cy="56" r="48" fill="none" strokeWidth="8"
                  strokeDasharray={`${seoResult.score * 3.02} 302`}
                  strokeLinecap="round"
                  className={cn(
                    seoResult.score >= 80 ? 'stroke-green-500' :
                    seoResult.score >= 60 ? 'stroke-yellow-500' :
                    seoResult.score >= 40 ? 'stroke-orange-500' : 'stroke-red-500'
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-3xl font-black', seoResult.color)}>{seoResult.score}</span>
                <span className="text-xs text-surface-400">/ 100</span>
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <span className={cn('text-4xl font-black', seoResult.color)}>{seoResult.grade}</span>
                <span className="text-surface-400 text-lg">SEO Score</span>
              </div>
              <p className="text-surface-400 text-sm mt-1">
                {seoResult.score >= 80 ? 'Excellent! Your video is well optimized.' :
                 seoResult.score >= 60 ? 'Good progress! A few more improvements will help.' :
                 seoResult.score >= 40 ? 'Getting there. Check the suggestions below.' :
                 'Needs work. Complete the checklist to improve discoverability.'}
              </p>
              <button 
                onClick={() => setShowScoreDetails(!showScoreDetails)}
                className="text-[#FF5F1F] text-sm mt-2 hover:underline"
              >
                {showScoreDetails ? 'Hide details' : 'View detailed breakdown'}
              </button>
            </div>
          </div>
          
          {saving && <Badge variant="info">Saving...</Badge>}
        </div>

        {/* Detailed breakdown */}
        {showScoreDetails && (
          <div className="mt-6 pt-6 border-t border-surface-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(checksByCategory).map(([category, checks]) => (
              <div key={category} className="bg-surface-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-surface-300 capitalize mb-3">{category}</h4>
                <div className="space-y-2">
                  {checks.map(check => (
                    <div key={check.id} className="flex items-start gap-2 text-xs">
                      <span className={check.passed ? 'text-green-400' : 'text-surface-500'}>
                        {check.passed ? '✓' : '○'}
                      </span>
                      <div className="flex-1">
                        <span className={check.passed ? 'text-surface-300' : 'text-surface-500'}>
                          {check.label}
                        </span>
                        {!check.passed && (
                          <p className="text-surface-500 mt-0.5">{check.tip}</p>
                        )}
                      </div>
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        check.passed ? 'bg-green-500/20 text-green-400' : 'bg-surface-700 text-surface-500'
                      )}>
                        +{check.weight}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Video Title</h2>
          <span className={cn(
            'text-xs',
            titleLength > 100 ? 'text-red-400' : titleLength > 70 ? 'text-yellow-400' : 'text-surface-500'
          )}>
            {titleLength}/100 characters
          </span>
        </div>
        <Input
          value={seo?.video_title || ''}
          onChange={(e) => updateSeo({ video_title: e.target.value })}
          placeholder="Enter a compelling title..."
          disabled={!canEdit}
        />
        <p className="text-xs text-surface-500">
          💡 Use your primary keyword near the beginning. Keep it under 60 characters for best display.
        </p>
      </div>

      {/* Description */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Description</h2>
          <span className={cn(
            'text-xs',
            descLength > 5000 ? 'text-red-400' : 'text-surface-500'
          )}>
            {descLength}/5000 characters
          </span>
        </div>
        <Textarea
          value={seo?.video_description || ''}
          onChange={(e) => updateSeo({ video_description: e.target.value })}
          placeholder="Describe your video content, include links, hashtags, and chapters..."
          rows={8}
          disabled={!canEdit}
        />
        <p className="text-xs text-surface-500">
          💡 First 2-3 lines appear in search. Include keywords naturally, add links and CTAs.
        </p>
      </div>

      {/* Tags */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-white">Tags</h2>
        {canEdit && (
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add a tag..."
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            />
            <Button onClick={addTag}>Add</Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {(seo?.tags || []).map((tag, i) => (
            <Badge key={i} variant="default" className="flex items-center gap-1">
              {tag}
              {canEdit && (
                <button onClick={() => removeTag(tag)} className="ml-1 hover:text-red-400">×</button>
              )}
            </Badge>
          ))}
          {(seo?.tags || []).length === 0 && (
            <p className="text-sm text-surface-500">No tags added yet</p>
          )}
        </div>
        <p className="text-xs text-surface-500">
          💡 Use 5-15 relevant tags. Mix broad and specific terms.
        </p>
      </div>

      {/* Target Keywords */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-white">Target Keywords</h2>
        {canEdit && (
          <div className="flex gap-2">
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="Add a keyword to target..."
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            />
            <Button onClick={addKeyword}>Add</Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {(seo?.target_keywords || []).map((kw, i) => (
            <Badge key={i} variant="info" className="flex items-center gap-1">
              {kw}
              {canEdit && (
                <button onClick={() => removeKeyword(kw)} className="ml-1 hover:text-red-400">×</button>
              )}
            </Badge>
          ))}
        </div>
      </div>

      {/* Hashtags */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-white">Hashtags</h2>
        {canEdit && (
          <div className="flex gap-2">
            <Input
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              placeholder="#hashtag"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
            />
            <Button onClick={addHashtag}>Add</Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {(seo?.hashtags || []).map((tag, i) => (
            <Badge key={i} className="bg-blue-500/20 text-blue-400 flex items-center gap-1">
              {tag}
              {canEdit && (
                <button onClick={() => removeHashtag(tag)} className="ml-1 hover:text-red-400">×</button>
              )}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-surface-500">
          💡 Use 3-5 hashtags max. First 3 appear above your title.
        </p>
      </div>

      {/* Category & Settings */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-white">Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Category"
            value={seo?.category || ''}
            onChange={(e) => updateSeo({ category: e.target.value })}
            options={YOUTUBE_CATEGORIES}
            disabled={!canEdit}
          />
          <Select
            label="Visibility"
            value={seo?.visibility || 'private'}
            onChange={(e) => updateSeo({ visibility: e.target.value as any })}
            options={[
              { value: 'public', label: 'Public' },
              { value: 'unlisted', label: 'Unlisted' },
              { value: 'private', label: 'Private' },
              { value: 'scheduled', label: 'Scheduled' },
            ]}
            disabled={!canEdit}
          />
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-surface-300">
            <input
              type="checkbox"
              checked={seo?.made_for_kids || false}
              onChange={(e) => updateSeo({ made_for_kids: e.target.checked })}
              disabled={!canEdit}
              className="rounded border-surface-600"
            />
            Made for kids
          </label>
          <label className="flex items-center gap-2 text-sm text-surface-300">
            <input
              type="checkbox"
              checked={seo?.age_restricted || false}
              onChange={(e) => updateSeo({ age_restricted: e.target.checked })}
              disabled={!canEdit}
              className="rounded border-surface-600"
            />
            Age-restricted
          </label>
        </div>
      </div>

      {/* Chapters */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Chapters / Timestamps</h2>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={addChapter}>
              Add Chapter
            </Button>
          )}
        </div>
        
        {chapters.length === 0 ? (
          <p className="text-sm text-surface-500">No chapters added yet. Chapters help viewers navigate your video.</p>
        ) : (
          <div className="space-y-2">
            {chapters.sort((a, b) => a.timestamp - b.timestamp).map((chapter) => (
              <div key={chapter.id} className="flex items-center gap-3 p-3 bg-surface-800 rounded-lg">
                <input
                  type="number"
                  value={chapter.timestamp}
                  onChange={(e) => updateChapter(chapter.id, { timestamp: parseInt(e.target.value) || 0 })}
                  className="w-20 bg-surface-700 border border-surface-600 rounded px-2 py-1 text-sm text-white"
                  placeholder="0"
                  disabled={!canEdit}
                />
                <span className="text-surface-500 text-sm">sec</span>
                <input
                  type="text"
                  value={chapter.title}
                  onChange={(e) => updateChapter(chapter.id, { title: e.target.value })}
                  className="flex-1 bg-transparent border-b border-surface-600 px-2 py-1 text-sm text-white focus:border-[#FF5F1F] focus:outline-none"
                  placeholder="Chapter title"
                  disabled={!canEdit}
                />
                {canEdit && (
                  <button
                    onClick={() => deleteChapter(chapter.id)}
                    className="text-surface-500 hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {chapters.length > 0 && (
          <div className="mt-4 p-3 bg-surface-800 rounded-lg">
            <p className="text-xs text-surface-500 mb-2">Copy this to your description:</p>
            <pre className="text-sm text-surface-300 whitespace-pre-wrap font-mono">
              {generateChaptersText()}
            </pre>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => navigator.clipboard.writeText(generateChaptersText())}
            >
              Copy to Clipboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
