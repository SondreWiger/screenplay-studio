'use client';
import { useEffect, useRef, useState } from 'react';
import { usePlaybackStore } from '@/lib/playbackStore';
import { useScriptStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/lib/stores';

export function PlaybackController({ characterVoices }: { characterVoices: Record<string, string> }) {
  const { 
    isActive, 
    playingElementId, 
    stopPlayback, 
    playNext, 
    playPrevious,
    audioCache 
  } = usePlaybackStore();
  
  const currentProject = useProjectStore(s => s.currentProject);
  const elements = useScriptStore(s => s.elements);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  // Sync isPlaying state with audio element
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, playingElementId]);

  if (!isActive || !currentProject) return null;

  const currentCache = playingElementId ? audioCache[playingElementId] : null;
  const currentElement = elements.find(e => e.id === playingElementId);
  
  // Find character name for display
  let charName = '';
  if (currentElement) {
    const idx = elements.findIndex(e => e.id === playingElementId);
    for (let i = idx - 1; i >= 0; i--) {
      if (elements[i].element_type === 'character') {
        charName = elements[i].content.trim().toUpperCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
        break;
      }
    }
  }

  const handleEnded = () => {
    playNext(currentProject.id, characterVoices);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10">
      <div className="bg-surface-800/95 backdrop-blur-md border border-surface-600 shadow-2xl rounded-2xl p-4 flex items-center gap-6 min-w-[320px]">
        
        {/* Hidden Audio Element */}
        {currentCache?.url && (
          <audio
            ref={audioRef}
            src={currentCache.url}
            autoPlay
            onEnded={handleEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        )}

        <div className="flex-1">
          <div className="text-xs text-brand-400 font-medium tracking-wider uppercase mb-1">
            Table Read Mode
          </div>
          <div className="text-sm text-white font-medium truncate max-w-[200px]">
            {charName || 'Dialogue'}
          </div>
          <div className="text-xs text-surface-400 mt-0.5 flex items-center gap-2">
            {currentCache?.status === 'generating' && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Generating AI Voice...
              </span>
            )}
            {currentCache?.status === 'error' && (
              <span className="text-red-400">{currentCache.error || 'Failed to generate'}</span>
            )}
            {currentCache?.status === 'ready' && 'Playing'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => playPrevious(currentProject.id, characterVoices)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-700 text-surface-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={currentCache?.status !== 'ready'}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>

          <button
            onClick={() => playNext(currentProject.id, characterVoices)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-700 text-surface-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
        </div>

        <button
          onClick={stopPlayback}
          className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-surface-700 border border-surface-600 text-surface-400 hover:text-white transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}
