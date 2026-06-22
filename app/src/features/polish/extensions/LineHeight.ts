import { Extension, type ChainedCommands } from "@tiptap/core";
import "@tiptap/extension-text-style";

export type LineHeightOptions = {
  types: string[];
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineHeight: {
      /**
       * Set the line height
       */
      setLineHeight: (height: string) => ReturnType;
      /**
       * Unset the line height
       */
      unsetLineHeight: () => ReturnType;
    };
  }
}

/**
 * LineHeight 扩展 - 支持设置行距（1.0 - 2.0）
 *
 * 用法：
 * editor.chain().focus().setLineHeight('1.5').run()
 * editor.chain().focus().unsetLineHeight().run()
 */
export const LineHeight = Extension.create<LineHeightOptions>({
  name: "lineHeight",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.lineHeight?.replace(/['"]+/g, ""),
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.lineHeight) {
                return {};
              }

              return {
                style: `line-height: ${attributes.lineHeight}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ chain }: { chain: () => ChainedCommands }) => {
          return chain().setMark("textStyle", { lineHeight }).run();
        },
      unsetLineHeight:
        () =>
        ({ chain }: { chain: () => ChainedCommands }) => {
          return chain()
            .setMark("textStyle", { lineHeight: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});
