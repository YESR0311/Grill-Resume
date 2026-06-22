import { Extension, type ChainedCommands } from "@tiptap/core";
import "@tiptap/extension-text-style";

export type FontWeightOptions = {
  types: string[];
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontWeight: {
      /**
       * Set the font weight
       */
      setFontWeight: (weight: string) => ReturnType;
      /**
       * Unset the font weight
       */
      unsetFontWeight: () => ReturnType;
    };
  }
}

/**
 * FontWeight 扩展 - 支持设置字重（300 - 700）
 *
 * 用法：
 * editor.chain().focus().setFontWeight('600').run()
 * editor.chain().focus().unsetFontWeight().run()
 */
export const FontWeight = Extension.create<FontWeightOptions>({
  name: "fontWeight",

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
          fontWeight: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.fontWeight?.replace(/['"]+/g, ""),
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.fontWeight) {
                return {};
              }

              return {
                style: `font-weight: ${attributes.fontWeight}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontWeight:
        (fontWeight: string) =>
        ({ chain }: { chain: () => ChainedCommands }) => {
          return chain().setMark("textStyle", { fontWeight }).run();
        },
      unsetFontWeight:
        () =>
        ({ chain }: { chain: () => ChainedCommands }) => {
          return chain()
            .setMark("textStyle", { fontWeight: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});
