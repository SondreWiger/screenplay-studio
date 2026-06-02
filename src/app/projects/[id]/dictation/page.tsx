'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore, useProjectStore, useScriptStore } from '@/lib/stores';
import { Button, Card, Toggle, Badge, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ScriptElementType } from '@/lib/types';

type ElementType = ScriptElementType;

const ELEMENT_TYPES: { value: ElementType; label: string }[] = [
  { value: 'scene_heading', label: 'Scene Heading' },
  { value: 'action', label: 'Action' },
  { value: 'character', label: 'Character' },
  { value: 'dialogue', label: 'Dialogue' },
  { value: 'parenthetical', label: 'Parenthetical' },
  { value: 'transition', label: 'Transition' },
  { value: 'note', label: 'Note' },
];

const QUICK_INSERTS = ['INT.', 'EXT.', 'CUT TO:', 'FADE IN:', 'FADE OUT.', 'CUT TO BLACK.', 'CONTINUED:', 'MORE'];

type RecStatus = 'idle' | 'listening' | 'paused' | 'error';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

export default function DictationPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject } = useProjectStore();
  const { scripts, currentScript, elements, addElement, fetchScripts, fetchElements } = useScriptStore();

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [elementType, setElementType] = useState<ElementType>('action');
  const [autoCapitalize, setAutoCapitalize] = useState(true);
  const [status, setStatus] = useState<RecStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [browserSupported, setBrowserSupported] = useState(true);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  const recognitionRef = useRef<any>(null);
  const bufferRef = useRef('');
  const transcriptRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setBrowserSupported(false);
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }
      if (final) {
        bufferRef.current += final;
        transcriptRef.current = bufferRef.current;
        setTranscript(bufferRef.current);
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') return;
      if (event.error === 'aborted') return;
      setStatus('error');
      setErrorMessage(`Recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      if (recognitionRef.current && isRecording) {
        try { recognitionRef.current.start(); } catch {}
      } else {
        setStatus('paused');
      }
    };

    recognitionRef.current = recognition;
    return () => {
      try { recognitionRef.current?.stop(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.onend = () => {
      if (isRecording) {
        try { recognitionRef.current.start(); } catch {}
      } else {
        setStatus('paused');
      }
    };
  }, [isRecording]);

  useEffect(() => {
    if (!currentScript && scripts.length > 0 && !scriptsLoaded) {
      const active = scripts.find(s => s.is_active) || scripts[0];
      if (active) fetchElements(active.id);
      setScriptsLoaded(true);
    }
  }, [scripts, currentScript, scriptsLoaded, fetchElements]);

  useEffect(() => {
    fetchScripts(params.id);
  }, [params.id, fetchScripts]);

  const toggleRecording = useCallback(async () => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setStatus('paused');
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error('Microphone permission denied. Please allow microphone access.');
      return;
    }

    bufferRef.current = transcriptRef.current;
    setTranscript(transcriptRef.current);
    setIsRecording(true);
    setStatus('listening');
    setInterimText('');

    try {
      recognitionRef.current.start();
    } catch {
      setStatus('error');
      setErrorMessage('Failed to start speech recognition.');
    }
  }, [isRecording]);

  const processTranscript = (text: string): string => {
    let processed = text.trim();
    if (!processed) return '';
    if (autoCapitalize) {
      processed = processed.replace(/(^|[.!?]\s+)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
    }
    return processed;
  };

  const handleAddToScript = useCallback(async () => {
    const processed = processTranscript(transcript);
    if (!processed) {
      toast.warning('Nothing to add. Start dictating first.');
      return;
    }
    if (!currentScript) {
      toast.error('No active script found. Create a script first.');
      return;
    }

    const newElement = await addElement({
      script_id: currentScript.id,
      element_type: elementType,
      content: processed,
      sort_order: elements.length,
      scene_number: null,
      revision_color: 'white',
      is_revised: false,
      is_omitted: false,
      scene_status: null,
      metadata: {},
      created_by: user?.id || null,
      last_edited_by: user?.id || null,
    });

    if (newElement) {
      toast.success('Added to script!');
      setTranscript('');
      transcriptRef.current = '';
      bufferRef.current = '';
      setInterimText('');
    }
  }, [transcript, elementType, currentScript, elements, addElement, user, autoCapitalize]);

  const handleQuickInsert = useCallback(async (text: string) => {
    if (!currentScript) {
      toast.error('No active script found.');
      return;
    }

    const insertType: ElementType = text === 'INT.' || text === 'EXT.' ? 'scene_heading' : 'transition';

    const newElement = await addElement({
      script_id: currentScript.id,
      element_type: insertType,
      content: text,
      sort_order: elements.length,
      scene_number: null,
      revision_color: 'white',
      is_revised: false,
      is_omitted: false,
      scene_status: null,
      metadata: {},
      created_by: user?.id || null,
      last_edited_by: user?.id || null,
    });

    if (newElement) {
      toast.success(`Added "${text}" to script`);
    }
  }, [currentScript, elements, addElement, user]);

  const handleClear = () => {
    setTranscript('');
    transcriptRef.current = '';
    bufferRef.current = '';
    setInterimText('');
  };

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  if (!browserSupported) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-red-500/10 border border-red-500/20">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-white mb-3">Browser Not Supported</h2>
          <p className="text-sm text-surface-400 leading-relaxed">
            Voice dictation requires the Web Speech API, which is not available in your current browser.
            Please use Chrome, Edge, or Safari on a supported device.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Voice Dictation</h1>
            <p className="text-sm text-surface-500 mt-1">
              {currentProject?.title || 'Project'} — {currentScript?.title || 'No script selected'}
            </p>
          </div>
          <Badge
            variant={status === 'listening' ? 'success' : status === 'error' ? 'error' : status === 'paused' ? 'warning' : 'default'}
            size="md"
          >
            {status === 'listening' && '● Listening'}
            {status === 'paused' && '⏸ Paused'}
            {status === 'error' && '✕ Error'}
            {status === 'idle' && '○ Ready'}
          </Badge>
        </div>

        {status === 'error' && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider mr-1">Element:</span>
            {ELEMENT_TYPES.map((et) => (
              <button
                key={et.value}
                onClick={() => setElementType(et.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                  elementType === et.value
                    ? 'bg-[#E54E15]/15 text-[#FF5F1F] ring-1 ring-[#FF5F1F]/20'
                    : 'text-surface-400 hover:text-white hover:bg-surface-800/60'
                )}
              >
                {et.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider mr-1">Insert:</span>
            {QUICK_INSERTS.map((qi) => (
              <button
                key={qi}
                onClick={() => handleQuickInsert(qi)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-surface-300 bg-surface-800/80 border border-surface-700/50 hover:border-[#FF5F1F]/40 hover:text-white hover:bg-surface-700/60 transition-all duration-200"
              >
                {qi}
              </button>
            ))}
          </div>
        </Card>

        <div className="flex items-center justify-center py-4 md:py-6">
          <div className="relative">
            {isRecording && (
              <>
                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                <div className="absolute inset-0 rounded-full bg-red-500/10 animate-pulse" />
              </>
            )}
            <button
              onClick={toggleRecording}
              className={cn(
                'relative z-10 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all duration-300',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/40',
                'active:scale-95',
                isRecording
                  ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/40'
                  : 'bg-surface-700 hover:bg-surface-600 shadow-lg shadow-black/30'
              )}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? (
                <svg className="w-8 h-8 md:w-10 md:h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-8 h-8 md:w-10 md:h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wider">Transcription</h3>
            <span className="text-xs text-surface-600">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          </div>

          <div className="min-h-[160px] md:min-h-[200px] max-h-[320px] overflow-y-auto rounded-lg bg-surface-950/60 border border-surface-800/60 p-4">
            {transcript || interimText ? (
              <p className="text-sm md:text-base text-white leading-relaxed whitespace-pre-wrap">
                {transcript}
                {interimText && (
                  <span className="text-surface-500 italic">{interimText}</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-surface-600 italic">
                {isRecording ? 'Listening... speak now' : 'Press the microphone button to start dictating'}
              </p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Toggle
              checked={autoCapitalize}
              onChange={setAutoCapitalize}
              label="Auto-capitalize"
              description="Capitalize first letter of each sentence"
              size="sm"
            />
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pb-8">
          <div className="flex items-center gap-3 flex-1">
            <Button
              variant="secondary"
              onClick={handleClear}
              disabled={!transcript && !interimText}
              className="flex-1 sm:flex-none"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear
            </Button>
          </div>
          <Button
            onClick={handleAddToScript}
            disabled={!transcript.trim()}
            size="lg"
            className="flex-1 sm:flex-none sm:min-w-[200px]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add to Script
          </Button>
        </div>
      </div>
    </div>
  );
}
