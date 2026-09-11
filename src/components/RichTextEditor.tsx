/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { Bold, Italic, List, Quote, Heading3 } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  id: string;
}

export default function RichTextEditor({ value, onChange, placeholder, rows = 4, id }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertText = (before: string, after: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(startPos, endPos);

    const replacement = before + (selectedText || "text") + after;
    const newValue = text.substring(0, startPos) + replacement + text.substring(endPos);
    
    onChange(newValue);

    // Refocus and select range
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        startPos + before.length,
        startPos + before.length + (selectedText || "text").length
      );
    }, 0);
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-950 focus-within:ring-1 focus-within:ring-amber-500 transition-all shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center space-x-1.5 p-1.5 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => insertText("**", "**")}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          title="Bold (**text**)"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertText("*", "*")}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          title="Italic (*text*)"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertText("### ")}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          title="Heading 3 (### )"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertText("\n- ")}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          title="Bullet List (- item)"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertText("\n> ")}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          title="Blockquote (> text)"
        >
          <Quote className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Start typing details..."}
        rows={rows}
        className="w-full bg-white dark:bg-slate-950 p-3 text-xs font-sans text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none border-0 block resize-none leading-relaxed"
      />
    </div>
  );
}
