'use client';

export default function KeybindsModule() {
  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white mb-4">Keybinds & Shortcuts</h1>
        <p className="text-surface-300 text-lg leading-relaxed max-w-3xl">
          Write at the speed of thought. Screenplay Studio is designed to keep your hands on the keyboard. Mastering these shortcuts will significantly improve your writing flow.
        </p>
      </div>

      {/* Script Formatting Shortcuts */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Script Formatting</h2>
        <div className="bg-surface-900/50 border border-surface-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-800/50 text-surface-300">
              <tr>
                <th className="px-6 py-3 font-medium">Element</th>
                <th className="px-6 py-3 font-medium">Shortcut (Mac)</th>
                <th className="px-6 py-3 font-medium">Shortcut (Windows)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800 text-surface-200">
              <tr>
                <td className="px-6 py-4 font-medium text-white">Scene Heading</td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ 1</kbd></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">Ctrl 1</kbd></td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-white">Action</td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ 2</kbd></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">Ctrl 2</kbd></td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-white">Character</td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ 3</kbd></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">Ctrl 3</kbd></td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-white">Parenthetical</td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ 4</kbd></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">Ctrl 4</kbd></td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-white">Dialogue</td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ 5</kbd></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">Ctrl 5</kbd></td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-white">Transition</td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ 6</kbd></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">Ctrl 6</kbd></td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-white">General Note</td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ 8</kbd></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">Ctrl 8</kbd></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-surface-400 mt-2">
          <strong>Tip:</strong> Pressing <kbd className="font-mono bg-surface-800 px-1 py-0.5 rounded text-[10px]">Enter</kbd> will intelligently guess the next element type. For example, pressing Enter after a Character element automatically creates a Dialogue element.
        </p>
      </section>

      {/* Text Styling */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Text Styling</h2>
        <div className="bg-surface-900/50 border border-surface-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-800/50 text-surface-300">
              <tr>
                <th className="px-6 py-3 font-medium">Style</th>
                <th className="px-6 py-3 font-medium">Shortcut (Mac)</th>
                <th className="px-6 py-3 font-medium">Shortcut (Windows)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800 text-surface-200">
              <tr>
                <td className="px-6 py-4 font-medium text-white"><strong>Bold</strong></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ B</kbd></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">Ctrl B</kbd></td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-white"><em>Italic</em></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ I</kbd></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">Ctrl I</kbd></td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-white"><span className="underline">Underline</span></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ U</kbd></td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">Ctrl U</kbd></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* App Navigation */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Global Navigation</h2>
        <div className="bg-surface-900/50 border border-surface-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm">
             <thead className="bg-surface-800/50 text-surface-300">
              <tr>
                <th className="px-6 py-3 font-medium">Action</th>
                <th className="px-6 py-3 font-medium">Shortcut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800 text-surface-200">
              <tr>
                <td className="px-6 py-4 font-medium text-white">Open Command Palette</td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ K</kbd></td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-white">Toggle Sidebar</td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ B</kbd></td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-white">Toggle Zen Mode</td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ ⌥ Z</kbd></td>
              </tr>
               <tr>
                <td className="px-6 py-4 font-medium text-white">Search in Script</td>
                <td className="px-6 py-4"><kbd className="font-mono bg-surface-800 px-2 py-1 rounded text-xs">⌘ F</kbd></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
