import { Extension, type ChainedCommands } from "@tiptap/core";
import "@tiptap/extension-text-style";

export type LetterSpacingOptions = {
  types: string[];
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    letterSpacing: {
      /**
       * Set the letter spacing
       */
      setLetterSpacing: (spacing: string) => ReturnType;
      /**
       * Unset the letter spacing
       */
      unsetLetterSpacing: () => ReturnType;
    };
  }
}

/**
 * LetterSpacing 扩展 - 支持设置字间距（0 - 5px）
 *
 * 用法：
 * editor.chain().focus().setLetterSpacing('2px').run()
 * editor.chain().focus().unsetLetterSpacing().run()
 */
export const LetterSpacing = Extension.create<LetterSpacingOptions>({
  name: "letterSpacing",

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
          letterSpacing: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.letterSpacing?.replace(/['"]+/g, ""),
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.letterSpacing) {
                return {};
              }

              return {
                style: `letter-spacing: ${attributes.letterSpacing}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLetterSpacing:
        (letterSpacing: string) =>
        ({ chain }: { chain: () => ChainedCommands }) => {
          return chain().setMark("textStyle", { letterSpacing }).run();
        },
      unsetLetterSpacing:
        () =>
        ({ chain }: { chain: () => ChainedCommands }) => {
          return chain()
            .setMark("textStyle", { letterSpacing: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});
