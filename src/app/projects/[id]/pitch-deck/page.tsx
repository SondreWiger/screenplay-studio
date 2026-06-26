'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, LoadingPage, EmptyState, Avatar } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Project, Character } from '@/lib/types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from '@/components/ui';

type SlideType = 'title' | 'logline' | 'synopsis' | 'characters' | 'vision';

interface Slide {
  id: SlideType;
  label: string;
}

const SLIDES: Slide[] = [
  { id: 'title', label: 'Title Page' },
  { id: 'logline', label: 'Logline & Details' },
  { id: 'synopsis', label: 'Synopsis' },
  { id: 'characters', label: 'Characters' },
  { id: 'vision', label: 'Vision / Tone' },
];

export default function PitchDeckPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [moodboardImages, setMoodboardImages] = useState<any[]>([]);
  
  const [activeSlide, setActiveSlide] = useState<SlideType>('title');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const deckRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [projRes, charsRes, moodRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('characters').select('*').eq('project_id', projectId).order('sort_order'),
        supabase.from('moodboard_items').select('*').eq('project_id', projectId).limit(6),
      ]);

      if (projRes.data) setProject(projRes.data as Project);
      if (charsRes.data) setCharacters(charsRes.data as Character[]);
      if (moodRes.data) setMoodboardImages(moodRes.data);
      
      setLoading(false);
    }
    load();
  }, [projectId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        const idx = SLIDES.findIndex(s => s.id === activeSlide);
        if (idx < SLIDES.length - 1) setActiveSlide(SLIDES[idx + 1].id);
      } else if (e.key === 'ArrowLeft') {
        const idx = SLIDES.findIndex(s => s.id === activeSlide);
        if (idx > 0) setActiveSlide(SLIDES[idx - 1].id);
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSlide, isFullscreen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      deckRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const exportPDF = async () => {
    if (!deckRef.current) return;
    setExporting(true);
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [1920, 1080]
    });

    try {
      const originalSlide = activeSlide;
      
      for (let i = 0; i < SLIDES.length; i++) {
        setActiveSlide(SLIDES[i].id);
        // Wait for render and animations
        await new Promise(r => setTimeout(r, 800));
        
        const canvas = await html2canvas(deckRef.current, {
          scale: 2,
          useCORS: true,
          logging: false,
          width: 1920,
          height: 1080,
          windowWidth: 1920,
          windowHeight: 1080
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 1920, 1080);
      }

      pdf.save(`${project?.title || 'Pitch_Deck'}.pdf`);
      toast.success('Pitch deck exported as PDF!');
      setActiveSlide(originalSlide);
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <LoadingPage />;
  if (!project) return <EmptyState title="Project Not Found" description="The project could not be loaded." icon="error" />;

  const SlideWrapper = ({ children, id }: { children: React.ReactNode, id: string }) => (
    <motion.div
      key={id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col w-full h-full bg-[#0a0a0f]"
    >
      {/* Background layer */}
      {project.cover_url && (
        <div className="absolute inset-0 z-0">
          <img src={project.cover_url} alt="" className="w-full h-full object-cover opacity-20 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/80 to-[#0a0a0f]" />
        </div>
      )}
      
      {/* Content */}
      <div className="relative z-10 flex-1 flex w-full h-full p-16">
        {children}
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] bg-surface-950 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 shrink-0 bg-surface-900/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Pitch Deck Builder</h1>
            <p className="text-xs text-surface-400">Present your project professionally</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {exporting && <span className="text-sm text-brand-400 animate-pulse mr-2">Generating PDF...</span>}
          <Button variant="secondary" onClick={toggleFullscreen}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            Present
          </Button>
          <Button onClick={exportPDF} disabled={exporting}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export PDF
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Sidebar Nav */}
        <div className="w-64 flex flex-col gap-2 shrink-0 overflow-y-auto">
          {SLIDES.map((slide, idx) => (
            <button
              key={slide.id}
              onClick={() => setActiveSlide(slide.id)}
              className={cn(
                'text-left px-4 py-3 rounded-xl transition-all duration-200 group flex items-center justify-between',
                activeSlide === slide.id 
                  ? 'bg-brand-500/10 border border-brand-500/30 shadow-lg shadow-brand-500/5' 
                  : 'bg-surface-900 border border-surface-800 hover:border-surface-600'
              )}
            >
              <div>
                <span className="text-[10px] font-bold tracking-widest uppercase text-surface-500 mb-1 block">Slide {idx + 1}</span>
                <span className={cn('text-sm font-medium', activeSlide === slide.id ? 'text-brand-400' : 'text-surface-300 group-hover:text-white')}>{slide.label}</span>
              </div>
            </button>
          ))}
          
          <div className="mt-8 p-4 rounded-xl bg-surface-900 border border-surface-800">
            <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Tips</h3>
            <p className="text-xs text-surface-500 leading-relaxed mb-3">To edit the content of these slides, update the details in your project settings, synopsis, and character profiles.</p>
            <p className="text-[10px] text-surface-600 font-mono">Use arrow keys to navigate</p>
          </div>
        </div>

        {/* Presentation Canvas Container */}
        <div className="flex-1 bg-black rounded-2xl overflow-hidden border border-surface-800 shadow-2xl relative flex items-center justify-center">
          
          {/* 16:9 Aspect Ratio Container for rendering */}
          <div 
            ref={deckRef}
            className="relative bg-[#0a0a0f] overflow-hidden"
            style={{
              width: isFullscreen ? '100vw' : '100%',
              height: isFullscreen ? '100vh' : '100%',
              aspectRatio: isFullscreen ? 'auto' : '16/9',
              maxHeight: isFullscreen ? 'none' : '100%',
              maxWidth: isFullscreen ? 'none' : 'calc(100vh * 16 / 9)'
            }}
          >
            <AnimatePresence mode="wait">
              {activeSlide === 'title' && (
                <SlideWrapper id="title">
                  <div className="w-full h-full flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
                    {project.cover_url && (
                      <motion.img 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        src={project.cover_url} 
                        alt="Cover" 
                        className="w-48 h-72 object-cover rounded-lg shadow-2xl mb-12 border border-white/10" 
                      />
                    )}
                    <motion.h1 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-7xl font-black text-white mb-6 tracking-tight"
                    >
                      {project.title}
                    </motion.h1>
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="w-24 h-1 bg-brand-500 mx-auto mb-8 rounded-full"
                    />
                    <motion.p 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-xl text-surface-300 uppercase tracking-widest font-medium"
                    >
                      A {project.genre?.join(' / ') || 'Project'}
                    </motion.p>
                  </div>
                </SlideWrapper>
              )}

              {activeSlide === 'logline' && (
                <SlideWrapper id="logline">
                  <div className="w-full h-full flex flex-col justify-center max-w-5xl mx-auto">
                    <h2 className="text-brand-500 font-bold tracking-widest uppercase mb-4">Logline</h2>
                    <p className="text-4xl md:text-5xl font-medium text-white leading-tight mb-16">
                      "{project.logline || 'No logline written yet.'}"
                    </p>
                    
                    <div className="grid grid-cols-3 gap-12 pt-12 border-t border-white/10">
                      <div>
                        <span className="block text-surface-500 uppercase tracking-wider text-sm font-bold mb-2">Format</span>
                        <span className="text-2xl text-white capitalize">{project.format || project.project_type || 'Feature Film'}</span>
                      </div>
                      <div>
                        <span className="block text-surface-500 uppercase tracking-wider text-sm font-bold mb-2">Genre</span>
                        <span className="text-2xl text-white">{project.genre?.join(', ') || 'Unspecified'}</span>
                      </div>
                      <div>
                        <span className="block text-surface-500 uppercase tracking-wider text-sm font-bold mb-2">Target Length</span>
                        <span className="text-2xl text-white">{project.target_length_minutes ? `${project.target_length_minutes} min` : 'TBD'}</span>
                      </div>
                    </div>
                  </div>
                </SlideWrapper>
              )}

              {activeSlide === 'synopsis' && (
                <SlideWrapper id="synopsis">
                  <div className="w-full h-full flex flex-col max-w-6xl mx-auto py-8">
                    <h2 className="text-brand-500 font-bold tracking-widest uppercase mb-12 text-xl">Synopsis</h2>
                    <div className="prose prose-invert prose-lg max-w-none prose-p:leading-relaxed prose-p:text-surface-200">
                      {project.synopsis ? (
                        project.synopsis.split('\n').map((para, i) => (
                          <p key={i} className="mb-6">{para}</p>
                        ))
                      ) : (
                        <p className="text-surface-500 italic">No synopsis written yet.</p>
                      )}
                    </div>
                  </div>
                </SlideWrapper>
              )}

              {activeSlide === 'characters' && (
                <SlideWrapper id="characters">
                  <div className="w-full h-full flex flex-col">
                    <h2 className="text-brand-500 font-bold tracking-widest uppercase mb-8 text-xl shrink-0">Main Characters</h2>
                    <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                        {characters.filter(c => c.is_main || c.role === 'protagonist' || c.role === 'antagonist').map((char, i) => (
                          <motion.div 
                            key={char.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col"
                          >
                            <div className="flex items-center gap-4 mb-4">
                              <Avatar src={char.avatar_url || char.actor_photo_url} name={char.name[0]} size="lg" />
                              <div>
                                <h3 className="text-xl font-bold text-white">{char.name}</h3>
                                <p className="text-brand-400 text-sm uppercase tracking-wider">{char.role || 'Main Character'}</p>
                              </div>
                            </div>
                            <p className="text-surface-300 text-sm leading-relaxed line-clamp-4">
                              {char.description || char.backstory || 'No description provided.'}
                            </p>
                          </motion.div>
                        ))}
                        {characters.length === 0 && (
                          <p className="text-surface-500 col-span-3">No characters added to this project yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </SlideWrapper>
              )}

              {activeSlide === 'vision' && (
                <SlideWrapper id="vision">
                  <div className="w-full h-full flex flex-col">
                    <h2 className="text-brand-500 font-bold tracking-widest uppercase mb-8 text-xl">Vision / Tone</h2>
                    <div className="flex-1 grid grid-cols-3 gap-4">
                      {moodboardImages.length > 0 ? moodboardImages.map((img, i) => (
                        <motion.div 
                          key={img.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="relative rounded-xl overflow-hidden border border-white/10 group"
                        >
                          <img src={img.url} alt="Moodboard" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        </motion.div>
                      )) : (
                        <div className="col-span-3 flex items-center justify-center text-surface-500 border border-dashed border-surface-700 rounded-2xl">
                          <p>Add images to the Moodboard to see them here.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </SlideWrapper>
              )}
            </AnimatePresence>
            
            {/* Slide Navigation Overlay */}
            {isFullscreen && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 opacity-0 hover:opacity-100 transition-opacity">
                {SLIDES.map((s) => (
                  <button 
                    key={s.id} 
                    onClick={() => setActiveSlide(s.id)}
                    className={cn(
                      "w-2.5 h-2.5 rounded-full transition-all",
                      activeSlide === s.id ? "bg-brand-500 w-6" : "bg-white/30 hover:bg-white/50"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
