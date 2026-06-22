import { Extension, type ChainedCommands } from "@tiptap/core";
import "@tiptap/extension-text-style";

export type FontSizeOptions = {
  types: string[];
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      /**
       * Set the font size
       */
      setFontSize: (size: string) => ReturnType;
      /**
       * Unset the font size
       */
      unsetFontSize: () => ReturnType;
    };
  }
}

/**
 * FontSize 扩展 - 支持设置字号（10pt - 24pt）
 *
 * 用法：
 * editor.chain().focus().setFontSize('16px').run()
 * editor.chain().focus().unsetFontSize().run()
 */
export const FontSize = Extension.create<FontSizeOptions>({
  name: "fontSize",

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
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.fontSize?.replace(/['"]+/g, ""),
            renderHTML: (attributes: { fontSize?: string }) => {
              if (!attributes.fontSize) {
                return {};
              }

              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: { chain: () => ChainedCommands }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => ChainedCommands }) => {
          return chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});
