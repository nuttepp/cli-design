"use client";

import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  dark: boolean;
}

function languageExtension(ext: string) {
  switch (ext) {
    case "html":
    case "htm":
      return html();
    case "css":
      return css();
    case "js":
    case "mjs":
    case "jsx":
      return javascript({ jsx: true });
    case "json":
      return json();
    case "md":
      return markdown();
    default:
      return [];
  }
}

const baseTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "12px" },
  ".cm-scroller": { fontFamily: "ui-monospace, monospace", overflow: "auto" },
  ".cm-gutters": { minWidth: "3em" },
});

export function CodeEditor({ value, onChange, language, dark }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeComp = useRef(new Compartment());
  const langComp = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Mount editor
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        baseTheme,
        themeComp.current.of(dark ? oneDark : []),
        langComp.current.of(languageExtension(language)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount — value/language/dark changes handled by separate effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. AI file refresh)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  // Swap theme
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeComp.current.reconfigure(dark ? oneDark : []),
    });
  }, [dark]);

  // Swap language
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: langComp.current.reconfigure(languageExtension(language)),
    });
  }, [language]);

  return <div ref={containerRef} className="h-full w-full" />;
}
