import { useTranslation } from "react-i18next";
import { EditableMarkdown } from "../fields/editable-markdown";
import type { ResumeSection, SummaryContent } from "../../../types/resume";

interface Props {
  section: ResumeSection;
  onUpdate: (content: Partial<SummaryContent>) => void;
}

export function SummarySection({ section, onUpdate }: Props) {
  const { t } = useTranslation();
  const content = section.content as SummaryContent;

  return (
    <EditableMarkdown
      label={t("editor.fields.description")}
      value={content.text || ""}
      onChange={(v) => onUpdate({ text: v })}
      rows={6}
    />
  );
}
