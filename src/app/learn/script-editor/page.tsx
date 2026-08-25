import React from 'react';
import ModuleLayout, { ModuleSection, KeybindTable } from '@/components/learn/ModuleLayout';

export default function ScriptEditorLearnPage() {
  return (
    <ModuleLayout 
      title="Script Editor" 
      description="The heart of Screenplay Studio. Learn how to format your screenplay seamlessly."
      icon="✎"
    >
      <ModuleSection title="The Basics">
        <p className="mb-4">
          The editor is designed to get out of your way. As you type, it automatically tries to guess the correct formatting element (Scene Heading, Action, Character, Dialogue, etc.) based on standard screenplay norms.
        </p>
        <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-6">
          <h4 className="text-white font-semibold mb-2">How Autocomplete Works</h4>
          <ul className="list-disc pl-5 space-y-2 text-sm text-surface-300">
            <li>Type <code className="bg-surface-800 px-1 rounded text-brand-300">INT.</code> or <code className="bg-surface-800 px-1 rounded text-brand-300">EXT.</code> to instantly trigger a <strong>Scene Heading</strong>.</li>
            <li>Pressing <strong>Enter</strong> after a Character name automatically switches to <strong>Dialogue</strong>.</li>
            <li>Pressing <strong>Enter</strong> on a blank Action line switches to <strong>Character</strong>.</li>
            <li>Type an open parenthesis <code className="bg-surface-800 px-1 rounded text-brand-300">(</code> inside Dialogue to create a <strong>Parenthetical</strong>.</li>
          </ul>
        </div>
      </ModuleSection>

      <ModuleSection title="Keyboard Navigation">
        <p className="mb-4">
          You don't need to use your mouse to change formatting. Use the <kbd className="px-2 py-1 bg-surface-800 rounded border border-surface-700 text-brand-300 font-mono text-xs shadow-sm">Tab</kbd> key to cycle through element types on the current line.
        </p>
        <KeybindTable 
          binds={[
            { key: 'Tab', action: 'Cycle forward through formatting elements (Action → Character → Dialogue → ...)' },
            { key: 'Shift + Tab', action: 'Cycle backward through formatting elements' },
            { key: 'Enter', action: 'Create a new line based on context (e.g. Dialogue follows Character)' },
            { key: 'Cmd/Ctrl + B', action: 'Toggle Bold text formatting' },
            { key: 'Cmd/Ctrl + I', action: 'Toggle Italic text formatting' },
            { key: 'Cmd/Ctrl + U', action: 'Toggle Underline text formatting' },
          ]} 
        />
      </ModuleSection>

      <ModuleSection title="The Sidebar (Gutter)">
        <p className="mb-4">
          To the left of your script is the "gutter". Hovering over the gutter reveals the element picker button. 
        </p>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 flex-shrink-0 bg-surface-800 rounded-lg border border-surface-700 flex items-center justify-center text-surface-400">
            ⋮⋮
          </div>
          <p className="text-sm mt-1">
            Clicking the handle <kbd className="px-2 py-1 bg-surface-800 rounded border border-surface-700 text-brand-300 font-mono text-xs shadow-sm">⋮⋮</kbd> next to any line allows you to manually select its formatting type, add notes, or delete the line entirely. This is useful if the automatic detection guesses incorrectly.
          </p>
        </div>
      </ModuleSection>

      <ModuleSection title="Zen Mode">
        <p>
          Need to focus? Click the <strong>Zen Mode</strong> icon in the top right toolbar to hide the sidebars, navigation, and toolbars, leaving you with just your script and a blank screen.
        </p>
      </ModuleSection>
    </ModuleLayout>
  );
}
