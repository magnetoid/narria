"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { updateChapterAction } from "@/lib/actions/chapters";

export interface ChapterEditorHandle {
  getHTML: () => string;
  getText: () => string;
  getSelectedText: () => string;
  replaceSelection: (text: string) => void;
  appendParagraphs: (text: string) => void;
  beginStream: () => void;
  streamChunk: (chunk: string) => void;
  endStream: () => void;
  focusEnd: () => void;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toParagraphsHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export const ChapterEditor = forwardRef<
  ChapterEditorHandle,
  {
    chapterId: string;
    initialContent: string;
    onChange?: () => void;
  }
>(function ChapterEditor({ chapterId, initialContent, onChange }, ref) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingFirst = useRef(true);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing this chapter — or let Narria continue for you…",
      }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: { class: "manuscript focus:outline-none" },
    },
    onUpdate: ({ editor }) => {
      onChange?.();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const html = editor.getHTML();
        void updateChapterAction(chapterId, {
          content: html,
          status: editor.getText().trim() ? "drafting" : "planned",
        });
      }, 1000);
    },
  });

  useImperativeHandle(
    ref,
    (): ChapterEditorHandle => ({
      getHTML: () => editor?.getHTML() ?? "",
      getText: () => editor?.getText() ?? "",
      getSelectedText: () => {
        if (!editor) return "";
        const { from, to } = editor.state.selection;
        return editor.state.doc.textBetween(from, to, "\n");
      },
      replaceSelection: (text) => {
        if (!editor) return;
        const html = toParagraphsHtml(text);
        const { empty } = editor.state.selection;
        const chain = editor.chain().focus();
        if (!empty) chain.deleteSelection();
        chain.insertContent(html).run();
      },
      appendParagraphs: (text) => {
        editor?.chain().focus("end").insertContent(toParagraphsHtml(text)).run();
      },
      beginStream: () => {
        streamingFirst.current = true;
        editor?.chain().focus("end").run();
      },
      streamChunk: (chunk) => {
        if (!editor) return;
        const clean = chunk.replace(/\s+/g, " ");
        if (streamingFirst.current) {
          const trimmed = chunk.replace(/^\s+/, "");
          if (!trimmed) return;
          editor.chain().focus("end").insertContent(`<p>${escapeHtml(trimmed.replace(/\s+/g, " "))}</p>`).run();
          streamingFirst.current = false;
        } else {
          editor.chain().focus("end").insertContent(escapeHtml(clean)).run();
        }
      },
      endStream: () => {
        streamingFirst.current = true;
      },
      focusEnd: () => editor?.chain().focus("end").run(),
    }),
    [editor],
  );

  return <EditorContent editor={editor} className="min-h-full" />;
});
