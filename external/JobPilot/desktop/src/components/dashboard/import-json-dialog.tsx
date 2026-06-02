import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import {
  importDocument,
  type DesktopDocumentDetail,
} from "../../lib/desktop-api";
import {
  importResumeFromFile,
  ResumeImportError,
  detectResumeImportFileType,
  resolveImportLanguage,
  MAX_RESUME_IMPORT_FILE_SIZE_BYTES,
  type ResumeImportProgress,
  type ResumeImportStage,
} from "../../lib/resume-import";
import { getDesktopAiRuntimeConfig } from "../editor/ai-dialog-helpers";
import {
  FileUploadArea,
  useFileValidation,
  ImportProgressDisplay,
  ImportStageIndicators,
} from "./file-upload-area";
import {
  IMPORT_STAGE_SEQUENCE,
  IMPORT_STAGE_PROGRESS_RANGES,
  calculateImportProgressPercent,
} from "./import-progress-stages";

interface ImportJsonDialogProps {
  open: boolean;
  onClose: () => void;
  onImport?: (document?: DesktopDocumentDetail | null) => void | Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function ImportJsonDialog({
  open,
  onClose,
  onImport,
}: ImportJsonDialogProps) {
  const { t, i18n } = useTranslation();

  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState<ResumeImportProgress | null>(null);
  const [resumeImportVisionModel, setResumeImportVisionModel] = useState("");
  const [isLoadingImportConfig, setIsLoadingImportConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { validateFile } = useFileValidation();

  useEffect(() => {
    if (!open) {
      return;
    }

    setIsLoadingImportConfig(true);
    void (async () => {
      try {
        const runtimeConfig = await getDesktopAiRuntimeConfig();
        setResumeImportVisionModel(runtimeConfig.resumeImportVisionModel || "");
      } catch {
        setResumeImportVisionModel("");
      } finally {
        setIsLoadingImportConfig(false);
      }
    })();
  }, [open]);

  const resetAndClose = () => {
    setFile(null);
    setError("");
    setIsDragging(false);
    setImportProgress(null);
    onClose();
  };

  const handleFileSelect = (selectedFile: File) => {
    setError("");
    setImportProgress(null);
    const validation = validateFile(selectedFile);
    if (!validation.isValid) {
      setError(validation.error || "Invalid file");
      return;
    }
    setFile(selectedFile);
  };

  const handleFileClear = () => {
    setFile(null);
    setError("");
    setImportProgress(null);
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setError("");

    try {
      const fileType = detectResumeImportFileType(file);
      let document: DesktopDocumentDetail;

      if (fileType === "json") {
        document = await handleJsonImport(file);
      } else {
        // Use unified import for PDF, Markdown, and images
        document = await handleUnifiedImport(file);
      }

      await onImport?.(document);
      resetAndClose();
    } catch (err: unknown) {
      let message: string;
      if (err instanceof ResumeImportError) {
        if (err.code === "vision_model_required_for_image") {
          message = t("dashboard.upload.imageNeedsVisionModel");
        } else if (err.code === "vision_model_required_for_scanned_pdf") {
          message = t("dashboard.upload.scannedPdfNeedsVisionModel");
        } else {
          message = err.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      } else {
        message = t("import.error");
      }
      console.error("[import-json-dialog] Import failed:", err);
      setError(message);
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const handleUnifiedImport = async (
    importFile: File
  ): Promise<DesktopDocumentDetail> => {
    return importResumeFromFile({
      file: importFile,
      language: resolveImportLanguage(i18n.language),
      onProgress: setImportProgress,
    });
  };

  const handleJsonImport = async (
    jsonFile: File
  ): Promise<DesktopDocumentDetail> => {
    const text = await jsonFile.text();
    const data = JSON.parse(text) as unknown;

    if (!isRecord(data)) {
      throw new Error(t("import.invalidFormat"));
    }

    const metadata = isRecord(data.metadata) ? data.metadata : {};
    const rawSections = Array.isArray(data.sections) ? data.sections : null;
    if (!rawSections) {
      throw new Error(t("import.invalidFormat"));
    }

    const sections = rawSections.map((section, index) => {
      if (!isRecord(section)) {
        throw new Error(t("import.invalidFormat"));
      }

      return {
        sectionType:
          readString(section.sectionType) ??
          readString(section.type) ??
          "custom",
        title: readString(section.title) ?? "custom",
        sortOrder:
          typeof section.sortOrder === "number" ? section.sortOrder : index,
        visible: typeof section.visible === "boolean" ? section.visible : true,
        content: isRecord(section.content) ? section.content : {},
      };
    });

    const themeSource = isRecord(data.theme)
      ? data.theme
      : isRecord(data.themeConfig)
        ? data.themeConfig
        : null;

    return importDocument({
      title:
        readString(data.title) ??
        readString(metadata.title) ??
        "Imported Resume",
      template: readString(data.template) ?? readString(metadata.template),
      language: readString(data.language) ?? readString(metadata.language),
      targetJobTitle:
        readString(data.targetJobTitle) ??
        readString(metadata.targetJobTitle) ??
        null,
      targetCompany:
        readString(data.targetCompany) ??
        readString(metadata.targetCompany) ??
        null,
      themeJson:
        readString(data.themeJson) ??
        (themeSource ? JSON.stringify(themeSource) : undefined),
      sections,
    });
  };

  // Vision model check for images
  const fileType = file ? detectResumeImportFileType(file) : null;
  const hasVisionModel = resumeImportVisionModel.trim().length > 0;
  const isImageFile = fileType === "image";
  const uploadBlockedByMissingVisionModel =
    isImageFile && !hasVisionModel && !isLoadingImportConfig;

  const progressPercent = calculateImportProgressPercent(importProgress);

  const currentStageLabel = importProgress
    ? t(`dashboard.upload.progress.${importProgress.stage}`)
    : "";
  const currentStageDescription = importProgress
    ? importProgress.stage === "extracting" || importProgress.stage === "rendering"
      ? t("dashboard.upload.progress.pageProgress", {
          completed: importProgress.completed,
          total: importProgress.total,
        })
      : t(`dashboard.upload.progress.${importProgress.stage}Description`)
    : "";

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={resetAndClose}>
      <div
        className="dialog-content max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="dialog-header">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
            <h2 className="dialog-title">{t("import.title")}</h2>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={resetAndClose}
            disabled={isImporting}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="dialog-body flex-1 overflow-y-auto">
          <p className="text-sm text-zinc-500 mb-4">
            {t("import.description")}
          </p>

          {isImporting && importProgress ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("dashboard.upload.progress.title")}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {t("dashboard.upload.progress.description")}
                    </p>
                  </div>
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-zinc-900 dark:text-zinc-100" />
                </div>

                <ImportProgressDisplay
                  fileName={importProgress.fileName}
                  stage={importProgress.stage}
                  completed={importProgress.completed}
                  total={importProgress.total}
                  progressPercent={progressPercent}
                />
              </div>

              <ImportStageIndicators currentStage={importProgress.stage} />
            </div>
          ) : (
            <>
              {/* Upload area */}
              <FileUploadArea
                file={file}
                onFileSelect={handleFileSelect}
                onFileClear={handleFileClear}
                isDragging={isDragging}
                onDragStateChange={setIsDragging}
                isDisabled={isImporting}
              />

              {/* Vision model hint for images */}
              {file && fileType === "image" && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                    {isLoadingImportConfig
                      ? t("dashboard.upload.loadingImportConfig")
                      : hasVisionModel
                        ? t("dashboard.upload.imageWillUseVisionModel", {
                            model: resumeImportVisionModel,
                          })
                        : t("dashboard.upload.imageNeedsVisionModel")}
                  </div>

                  {!hasVisionModel && !isLoadingImportConfig && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("dashboard.upload.configureVisionModelHint")}
                    </p>
                  )}
                </div>
              )}

              {error && <p className="form-error mt-3">{error}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="dialog-footer">
          <Button variant="secondary" onClick={resetAndClose} disabled={isImporting}>
            {t("commonCancel")}
          </Button>
          <Button
            onClick={() => void handleImport()}
            disabled={!file || isImporting || uploadBlockedByMissingVisionModel}
          >
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isImporting ? t("import.importing") : t("import.importBtn")}
          </Button>
        </div>
      </div>
    </div>
  );
}
