'use client';

import React from 'react';

/**
 * Renders chat message content with inline formatting support:
 *  - **bold**    → <strong>
 *  - *italic*    → <em>
 *  - __underline__ → <u>
 *  - [text](url)  → <a> link
 *
 * Nested formatting is supported (e.g. **bold *and italic***).
 * Links are opened in a new tab with rel="noopener noreferrer".
 */

// Match link, bold, italic, or underline tokens (order matters for regex alternation)
const TOKEN_RE =
  /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(__([^_]+?)__)|(\*\*(.+?)\*\*)|(\*(.+?)\*)/g;

function parseTokens(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    // Push plain text before this match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `t-${match.index}`;

    if (match[1]) {
      // Link: [text](url)
      const linkText = match[2];
      const url = match[3];
      nodes.push(
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#FF5F1F] underline underline-offset-2 hover:text-[#ff7a45] transition-colors break-all"
        >
          {linkText}
        </a>
      );
    } else if (match[4]) {
      // Underline: __text__
      const inner = match[5];
      nodes.push(
        <u key={key} className="underline underline-offset-2">
          {parseTokens(inner)}
        </u>
      );
    } else if (match[6]) {
      // Bold: **text**
      const inner = match[7];
      nodes.push(
        <strong key={key} className="font-semibold text-white">
          {parseTokens(inner)}
        </strong>
      );
    } else if (match[8]) {
      // Italic: *text*
      const inner = match[9];
      nodes.push(
        <em key={key} className="italic">
          {parseTokens(inner)}
        </em>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining plain text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function FormattedChatText({ content, className }: { content: string; className?: string }) {
  // Split by newlines to preserve whitespace-pre-wrap behaviour
  const lines = content.split('\n');

  return (
    <span className={className}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {parseTokens(line)}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </span>
  );
}
