"use client";

import { createContext, useContext } from "react";
import type { Editor } from "@tiptap/react";

/**
 * 当前聚焦的 Tiptap 编辑器引用（design §5.3）。
 * StructuredEditor 内每条 bullet 是一个 Tiptap 实例；聚焦时注册为 active，
 * StyleControls 的 inline mark 按钮（bold/italic/underline/strike/color）操作 active editor。
 */
export type ActiveEditorContextValue = {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
};

export const ActiveEditorContext = createContext<ActiveEditorContextValue>({
  editor: null,
  setEditor: () => {},
});

export function useActiveEditor(): ActiveEditorContextValue {
  return useContext(ActiveEditorContext);
}
