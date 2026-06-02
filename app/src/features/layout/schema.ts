export type LayoutTheme = {
  fontCJK: string;
  fontLatin: string;
  accentColor: string;
  baseFontPt: number;
  lineSpacing: number;
};

export type LayoutPage = {
  size: "A4";
  columns: 1;
  marginsMm: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
};

export type LayoutBullet = {
  bulletId: string;
  text: string;
  displayTextOverride?: string;
  sourceEvidenceIds: string[];
};

export type LayoutTextItem = {
  id: string;
  text: string;
};

export type LayoutBlock =
  | {
      kind: "header";
      name: string;
      targetRole?: string;
      metaLines: string[];
      contacts: string[];
      photo?: { widthMm: number; heightMm: number; placeholder: boolean };
    }
  | { kind: "section-title"; zh: string; en?: string }
  | { kind: "profile"; headline?: string; bullets: LayoutBullet[] }
  | { kind: "experience"; id: string; org: string; role: string; period: string; location?: string; bullets: LayoutBullet[] }
  | { kind: "project"; id: string; name: string; role?: string; period?: string; details: LayoutTextItem[]; bullets: LayoutBullet[] }
  | { kind: "education"; id: string; org: string; degree?: string; period: string; meta?: string; notes: LayoutTextItem[] }
  | { kind: "skills"; groups: Array<{ id: string; label: string; items: string[] }>; extras: LayoutTextItem[] };

export type LayoutSchema = {
  version: "layout-v1";
  page: LayoutPage;
  theme: LayoutTheme;
  blocks: LayoutBlock[];
  meta: {
    confirmedOnly: true;
    partialMode: boolean;
  };
};

export type LayoutProjection = {
  schema: LayoutSchema;
  gap: {
    confirmedExperienceBullets: number;
    excludedExperienceBullets: number;
    confirmedProjectBullets: number;
    excludedProjectBullets: number;
    missingBasics: string[];
  };
};

export interface LayoutRenderer<TOut> {
  render(schema: LayoutSchema): TOut;
}
