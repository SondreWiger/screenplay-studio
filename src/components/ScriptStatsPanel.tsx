'use client';

import { useMemo } from 'react';

interface ScriptElement {
  type: string;
  content: string;
}

interface ScriptStatsPanelProps {
  elements: ScriptElement[];
  /** Whether to show as a compact horizontal bar or full sidebar panel */
  mode?: 'bar' | 'panel';
}

function countWords(text: string): number {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

const WORDS_PER_PAGE = 56 * 8; // ~56 lines/page × ~8 words/line for screenplay format
const MINS_PER_PAGE = 1; // industry standard: 1 page ≈ 1 minute of screen time

export function ScriptStatsPanel({ elements, mode = 'panel' }: ScriptStatsPanelProps) {
  const stats = useMemo(() => {
    let totalWords = 0;
    let sceneCount = 0;
    let dialogueWords = 0;
    let actionWords = 0;
    const characterWordMap: Record<string, number> = {};
    let currentCharacter = '';

    for (const el of elements) {
      const text = el.content ?? '';
      const words = countWords(text);
      totalWords += words;

      switch (el.type) {
        case 'scene_heading':
          sceneCount++;
          currentCharacter = '';
          break;
        case 'character':
          currentCharacter = text.trim().toUpperCase();
          break;
        case 'dialogue':
          dialogueWords += words;
          if (currentCharacter) {
            characterWordMap[currentCharacter] = (characterWordMap[currentCharacter] ?? 0) + words;
          }
          break;
        case 'action':
          actionWords += words;
          currentCharacter = '';
          break;
        default:
          currentCharacter = '';
      }
    }

    const estimatedPages = Math.max(1, Math.round(totalWords / WORDS_PER_PAGE));
    const estimatedRuntime = estimatedPages * MINS_PER_PAGE;
    const dialoguePct = totalWords > 0 ? Math.round((dialogueWords / totalWords) * 100) : 0;
    const actionPct = totalWords > 0 ? Math.round((actionWords / totalWords) * 100) : 0;

    // Top 5 characters by word count
    const topCharacters = Object.entries(characterWordMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const maxCharWords = topCharacters[0]?.[1] ?? 1;

    return {
      totalWords,
      sceneCount,
      estimatedPages,
      estimatedRuntime,
      dialoguePct,
      actionPct,
      topCharacters,
      maxCharWords,
    };
  }, [elements]);

  const formatRuntime = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  if (mode === 'bar') {
    // Compact single-line bar for toolbar use
    return (
      <div className="flex items-center gap-4 text-xs text-surface-500 font-mono select-none">
        <span title="Total words">{stats.totalWords.toLocaleString()} words</span>
        <span className="text-surface-700">·</span>
        <span title="Estimated pages">~{stats.estimatedPages}p</span>
        <span className="text-surface-700">·</span>
        <span title="Estimated runtime">~{formatRuntime(stats.estimatedRuntime)}</span>
        <span className="text-surface-700">·</span>
        <span title="Scene count">{stats.sceneCount} scenes</span>
      </div>
    );
  }

  // Full panel
  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
      <h3 className="text-xs font-bold uppercase tracking-widest text-surface-500">Script Stats</h3>

      {/* Core numbers */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Words', value: stats.totalWords.toLocaleString() },
          { label: 'Pages', value: `~${stats.estimatedPages}` },
          { label: 'Runtime', value: `~${formatRuntime(stats.estimatedRuntime)}` },
          { label: 'Scenes', value: stats.sceneCount },
        ].map((s) => (
          <div
            key={s.label}
            className="flex flex-col gap-0.5 p-3 rounded-lg bg-surface-800 border border-surface-700"
          >
            <span className="text-lg font-bold text-surface-100 leading-none">{s.value}</span>
            <span className="text-[10px] text-surface-500 uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Dialogue / Action ratio */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] text-surface-500">
          <span>Dialogue {stats.dialoguePct}%</span>
          <span>Action {stats.actionPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-800 overflow-hidden flex">
          <div
            className="h-full rounded-l-full transition-all duration-500"
            style={{
              width: `${stats.dialoguePct}%`,
              background: 'var(--theme-brand, #FF5F1F)',
            }}
          />
          <div
            className="h-full rounded-r-full transition-all duration-500"
            style={{
              width: `${stats.actionPct}%`,
              background: '#6366f1',
            }}
          />
        </div>
        <div className="flex items-center gap-3 text-[10px] text-surface-600">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'var(--theme-brand, #FF5F1F)' }} />
            Dialogue
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block" />
            Action
          </span>
        </div>
      </div>

      {/* Top characters */}
      {stats.topCharacters.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500">
            Most Lines
          </p>
          <div className="flex flex-col gap-2">
            {stats.topCharacters.map(([name, words]) => (
              <div key={name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-surface-300 truncate max-w-[120px]">{name}</span>
                  <span className="text-[11px] text-surface-600 font-mono">{words.toLocaleString()}w</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(words / stats.maxCharWords) * 100}%`,
                      background: 'var(--theme-brand, #FF5F1F)',
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
