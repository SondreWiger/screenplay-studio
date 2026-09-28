import { create } from 'zustand';
import { useScriptStore } from './stores';

interface AudioCacheEntry {
  url: string | null;
  status: 'idle' | 'generating' | 'ready' | 'error';
  error?: string;
}

interface PlaybackState {
  isActive: boolean;
  playingElementId: string | null;
  playlist: string[];
  currentIndex: number;
  audioCache: Record<string, AudioCacheEntry>;
  
  // Actions
  startPlayback: (projectId: string, startElementId?: string, characterVoices?: Record<string, string>) => void;
  stopPlayback: () => void;
  playNext: (projectId: string, characterVoices: Record<string, string>) => void;
  playPrevious: (projectId: string, characterVoices: Record<string, string>) => void;
  prefetchAudio: (elementId: string, projectId: string, characterVoices: Record<string, string>) => Promise<void>;
  markAudioDone: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  isActive: false,
  playingElementId: null,
  playlist: [],
  currentIndex: -1,
  audioCache: {},

  startPlayback: (projectId, startElementId, characterVoices) => {
    const { elements } = useScriptStore.getState();
    const dialogueElements = elements.filter(e => e.element_type === 'dialogue');
    const playlist = dialogueElements.map(e => e.id);
    
    if (playlist.length === 0) return;

    let startIndex = 0;
    if (startElementId) {
      const idx = playlist.indexOf(startElementId);
      if (idx !== -1) startIndex = idx;
    }

    set({ 
      isActive: true, 
      playlist, 
      currentIndex: startIndex, 
      playingElementId: playlist[startIndex],
    });

    if (characterVoices) {
      get().prefetchAudio(playlist[startIndex], projectId, characterVoices);
      if (startIndex + 1 < playlist.length) {
        get().prefetchAudio(playlist[startIndex + 1], projectId, characterVoices);
      }
      if (startIndex + 2 < playlist.length) {
        get().prefetchAudio(playlist[startIndex + 2], projectId, characterVoices);
      }
    }
  },

  stopPlayback: () => {
    set({ isActive: false, playingElementId: null });
  },

  playNext: (projectId, characterVoices) => {
    const { playlist, currentIndex } = get();
    if (currentIndex + 1 < playlist.length) {
      const nextIndex = currentIndex + 1;
      set({ currentIndex: nextIndex, playingElementId: playlist[nextIndex] });
      
      if (nextIndex + 2 < playlist.length) {
        get().prefetchAudio(playlist[nextIndex + 2], projectId, characterVoices);
      }
    } else {
      set({ isActive: false, playingElementId: null });
    }
  },

  playPrevious: (projectId, characterVoices) => {
    const { playlist, currentIndex } = get();
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      set({ currentIndex: prevIndex, playingElementId: playlist[prevIndex] });
      get().prefetchAudio(playlist[prevIndex], projectId, characterVoices);
    }
  },

  markAudioDone: () => {
    // Relies on component calling playNext
  },

  prefetchAudio: async (elementId, projectId, characterVoices) => {
    const { audioCache } = get();
    if (audioCache[elementId] && (audioCache[elementId].status === 'generating' || audioCache[elementId].status === 'ready')) {
      return;
    }

    set({
      audioCache: {
        ...get().audioCache,
        [elementId]: { url: null, status: 'generating' }
      }
    });

    const state = useScriptStore.getState();
    const idx = state.elements.findIndex(e => e.id === elementId);
    let charName = '';
    for (let i = idx - 1; i >= 0; i--) {
      if (state.elements[i].element_type === 'character') {
        charName = state.elements[i].content.trim().toUpperCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
        break;
      }
    }

    const voiceId = characterVoices[charName];
    if (!voiceId) {
      set({
        audioCache: {
          ...get().audioCache,
          [elementId]: { url: null, status: 'error', error: `No voice for ${charName || 'this character'}` }
        }
      });
      return;
    }

    const element = state.elements[idx];
    if (!element || !element.content) {
      set({
        audioCache: {
          ...get().audioCache,
          [elementId]: { url: null, status: 'error', error: 'Empty dialogue' }
        }
      });
      return;
    }

    try {
      const res = await fetch('/api/audio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: element.content.replace(/<[^>]*>/g, ''),
          voice_id: voiceId,
          project_id: projectId
        })
      });

      if (!res.ok) {
        let errMessage = 'Failed to generate';
        try {
          const errData = await res.json();
          errMessage = errData.error || errMessage;
        } catch (e) {
          // ignore parsing error
        }
        throw new Error(errMessage);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      set({
        audioCache: {
          ...get().audioCache,
          [elementId]: { url, status: 'ready' }
        }
      });
    } catch (err: any) {
      set({
        audioCache: {
          ...get().audioCache,
          [elementId]: { url: null, status: 'error', error: err.message || 'Error' }
        }
      });
    }
  }
}));
