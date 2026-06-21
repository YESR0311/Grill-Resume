"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { saveDraftAction } from "@/app/polish/[id]/actions";
import { getTemplateStyle } from "@/features/polish/templates";
import type { ResumeDraft, ResumeStyle } from "@/features/polish/types";

/**
 * DraftProvider（design §5.3）。
 * 持有草稿状态与编辑操作，供编辑器组件树消费。
 * 暴露：templateId / draft / updateField / applyTemplate / onSave。
 */

type DraftState = {
  draft: ResumeDraft;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
};

type DraftAction =
  | { type: "UPDATE_FIELD"; field: keyof ResumeDraft; value: unknown }
  | { type: "UPDATE_STYLE"; patch: Partial<ResumeStyle> }
  | { type: "APPLY_TEMPLATE"; templateId: string }
  | { type: "REPLACE_DRAFT"; draft: ResumeDraft }
  | { type: "SAVE_START" }
  | { type: "SAVE_OK"; draft: ResumeDraft }
  | { type: "SAVE_FAIL"; error: string };

function touch(draft: ResumeDraft): ResumeDraft {
  return { ...draft, updatedAt: new Date().toISOString() };
}

function reducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "UPDATE_FIELD":
      return {
        ...state,
        dirty: true,
        draft: touch({ ...state.draft, [action.field]: action.value } as ResumeDraft),
      };
    case "UPDATE_STYLE":
      return {
        ...state,
        dirty: true,
        draft: touch({
          ...state.draft,
          style: { ...state.draft.style, ...action.patch },
        }),
      };
    case "APPLY_TEMPLATE": {
      // 只换样式参数，简历正文内容不变（design §4.3）。
      const style = getTemplateStyle(action.templateId);
      return {
        ...state,
        dirty: true,
        draft: touch({ ...state.draft, templateId: action.templateId, style }),
      };
    }
    case "REPLACE_DRAFT":
      return { ...state, draft: action.draft, dirty: false };
    case "SAVE_START":
      return { ...state, saving: true, saveError: null };
    case "SAVE_OK":
      return { ...state, saving: false, dirty: false, draft: action.draft };
    case "SAVE_FAIL":
      return { ...state, saving: false, saveError: action.error };
    default:
      return state;
  }
}

type DraftContextValue = {
  draft: ResumeDraft;
  templateId: string;
  style: ResumeStyle;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  updateField: (field: keyof ResumeDraft, value: unknown) => void;
  updateStyle: (patch: Partial<ResumeStyle>) => void;
  applyTemplate: (templateId: string) => void;
  onSave: () => Promise<boolean>;
};

const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftProvider({
  initialDraft,
  children,
}: {
  initialDraft: ResumeDraft;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    draft: initialDraft,
    dirty: false,
    saving: false,
    saveError: null,
  });

  const updateField = useCallback((field: keyof ResumeDraft, value: unknown) => {
    dispatch({ type: "UPDATE_FIELD", field, value });
  }, []);

  const updateStyle = useCallback((patch: Partial<ResumeStyle>) => {
    dispatch({ type: "UPDATE_STYLE", patch });
  }, []);

  const applyTemplate = useCallback((templateId: string) => {
    dispatch({ type: "APPLY_TEMPLATE", templateId });
  }, []);

  const onSave = useCallback(async () => {
    dispatch({ type: "SAVE_START" });
    const snapshot = { ...state.draft, updatedAt: new Date().toISOString() };
    const result = await saveDraftAction(snapshot);
    if (result.ok) {
      dispatch({ type: "SAVE_OK", draft: snapshot });
      return true;
    }
    dispatch({ type: "SAVE_FAIL", error: result.error });
    return false;
  }, [state.draft]);

  const value = useMemo<DraftContextValue>(
    () => ({
      draft: state.draft,
      templateId: state.draft.templateId,
      style: state.draft.style,
      dirty: state.dirty,
      saving: state.saving,
      saveError: state.saveError,
      updateField,
      updateStyle,
      applyTemplate,
      onSave,
    }),
    [state, updateField, updateStyle, applyTemplate, onSave],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft 必须在 DraftProvider 内使用");
  return ctx;
}
