'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, LoadingPage, toast, ToastContainer } from '@/components/ui';

// ============================================================
// Custom Branding / Brand Kit — Pro Feature
// Project-level branding: colors, logos, watermarks, cover pages,
// and export themes. Saves to projects.custom_branding JSONB column.
// ============================================================

export default function BrandingPage() {
  const params = useParams();
  const { user } = useAuth();
  const { isPro } = useProFeatures();
  const { currentProject } = useProjectStore();
  const hasProAccess = isPro || currentProject?.pro_enabled === true;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Branding state
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#F59E0B');
  const [logoUrl, setLogoUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(15);
  const [coverTitle, setCoverTitle] = useState('');
  const [coverSubtitle, setCoverSubtitle] = useState('');
  const [fontFamily, setFontFamily] = useState('Courier Prime');
  const [headerTemplate, setHeaderTemplate] = useState('minimal');

  useEffect(() => {
    if (!hasProAccess) { setLoading(false); return; }
    loadBranding();
  }, [hasProAccess]);

  const loadBranding = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('projects')
      .select('custom_branding')
      .eq('id', params.id)
      .single();

    if (data?.custom_branding) {
      const b = data.custom_branding as Record<string, any>;
      setPrimaryColor(b.primary_color || '#3B82F6');
      setSecondaryColor(b.secondary_color || '#F59E0B');
      setLogoUrl(b.logo_url || '');
      setCompanyName(b.company_name || '');
      setWatermarkText(b.watermark || '');
      setWatermarkOpacity(b.watermark_opacity ?? 15);
      setCoverTitle(b.cover_title || '');
      setCoverSubtitle(b.cover_subtitle || '');
      setFontFamily(b.font_family || 'Courier Prime');
      setHeaderTemplate(b.header_template || 'minimal');
    }
    setLoading(false);
  };

  const saveBranding = async () => {
    setSaving(true);
    const supabase = createClient();
    const branding = {
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      logo_url: logoUrl,
      company_name: companyName,
      watermark: watermarkText,
      watermark_opacity: watermarkOpacity,
      cover_title: coverTitle,
      cover_subtitle: coverSubtitle,
      font_family: fontFamily,
      header_template: headerTemplate,
      color: primaryColor,
    };
    const { error } = await supabase.from('projects').update({
      custom_branding: branding,
    }).eq('id', params.id);

    if (error) {
      toast('Failed to save branding: ' + error.message, 'error');
    } else {
      toast('Branding saved successfully!', 'success');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (!hasProAccess) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md p-8 text-center">
          <div className="text-4xl mb-4">🎨</div>
          <h2 className="text-xl font-black text-white mb-2">Custom Branding</h2>
          <p className="text-sm text-surface-400 mb-6">Add your logo, colors, watermarks, and custom cover pages to every export.</p>
          <Button onClick={() => { window.location.href = '/pro'; }}>Upgrade to Pro</Button>
        </Card>
      </div>
    );
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <ToastContainer />
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white">Brand Kit</h1>
            <Badge variant="warning">⭐ Pro</Badge>
          </div>
          <p className="text-sm text-surface-400 mt-1">Customize the look of your exports and shared content</p>
        </div>
        <Button onClick={saveBranding} loading={saving}>{saved ? '✓ Saved!' : 'Save Changes'}</Button>
      </div>

      {/* Company Info */}
      <Card className="p-5">
        <h3 className="text-base font-semibold text-white mb-4">Company / Production</h3>
        <div>
          <label className="block text-sm text-surface-400 mb-2">Company / Production Company Name</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Acme Studios"
            className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF5F1F]" />
          <p className="text-[11px] text-surface-500 mt-1">Appears on cover pages and branded exports</p>
        </div>
      </Card>

      {/* Colors */}
      <Card className="p-5">
        <h3 className="text-base font-semibold text-white mb-4">Colors</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-surface-400 mb-2">Primary Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
              <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-surface-400 mb-2">Secondary Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
              <input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white font-mono" />
            </div>
          </div>
        </div>
        {/* Preview */}
        <div className="mt-4 p-4 rounded-lg border border-surface-800 bg-surface-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: primaryColor }} />
            <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: secondaryColor }} />
            <span className="text-xs text-surface-500">Color preview</span>
          </div>
        </div>
      </Card>

      {/* Logo & Watermark */}
      <Card className="p-5">
        <h3 className="text-base font-semibold text-white mb-4">Logo & Watermark</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-surface-400 mb-2">Logo URL</label>
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://yourcompany.com/logo.png"
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF5F1F]" />
            <p className="text-[11px] text-surface-500 mt-1">Appears on cover pages and exported documents</p>
          </div>
          <div>
            <label className="block text-sm text-surface-400 mb-2">Watermark Text</label>
            <input value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} placeholder="e.g. CONFIDENTIAL — Draft"
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF5F1F]" />
          </div>
          <div>
            <label className="block text-sm text-surface-400 mb-2">Watermark Opacity: {watermarkOpacity}%</label>
            <input type="range" min={5} max={50} value={watermarkOpacity} onChange={(e) => setWatermarkOpacity(+e.target.value)}
              className="w-full accent-brand-500" />
          </div>
        </div>
      </Card>

      {/* Cover Page */}
      <Card className="p-5">
        <h3 className="text-base font-semibold text-white mb-4">Cover Page</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-surface-400 mb-2">Title Override</label>
              <input value={coverTitle} onChange={(e) => setCoverTitle(e.target.value)} placeholder="Uses project title if empty"
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF5F1F]" />
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-2">Subtitle</label>
              <input value={coverSubtitle} onChange={(e) => setCoverSubtitle(e.target.value)} placeholder="e.g. Written by Jane Doe"
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF5F1F]" />
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-2">Font</label>
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF5F1F]">
                <option value="Courier Prime">Courier Prime (Industry Standard)</option>
                <option value="Courier New">Courier New</option>
                <option value="Source Code Pro">Source Code Pro</option>
                <option value="JetBrains Mono">JetBrains Mono</option>
              </select>
            </div>
          </div>
          {/* Cover Preview */}
          <div className="rounded-lg border border-surface-700 bg-surface-900 p-6 flex flex-col items-center justify-center min-h-[240px]" style={{ fontFamily }}>
            {logoUrl && <img src={logoUrl} alt="Logo" className="max-h-8 mb-4" />}
            <p className="text-lg font-bold text-white text-center">{coverTitle || 'UNTITLED PROJECT'}</p>
            {coverSubtitle && <p className="text-sm text-white/60 mt-1 text-center">{coverSubtitle}</p>}
            {watermarkText && (
              <p className="absolute text-4xl font-black text-gray-300 rotate-[-30deg] pointer-events-none select-none" style={{ opacity: watermarkOpacity / 100 }}>
                {watermarkText}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Header Template */}
      <Card className="p-5">
        <h3 className="text-base font-semibold text-white mb-4">Export Header Style</h3>
        <div className="grid grid-cols-3 gap-3">
          {['minimal', 'classic', 'branded'].map((t) => (
            <button key={t} onClick={() => setHeaderTemplate(t)}
              className={`p-4 rounded-lg border text-center transition-colors ${headerTemplate === t ? 'border-[#FF5F1F] bg-[#FF5F1F]/10' : 'border-surface-700 hover:border-surface-600'}`}>
              <p className="text-sm font-medium text-white capitalize">{t}</p>
              <p className="text-[10px] text-surface-500 mt-1">
                {t === 'minimal' ? 'Clean, no extras' : t === 'classic' ? 'Page numbers + date' : 'Logo + company info'}
              </p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
