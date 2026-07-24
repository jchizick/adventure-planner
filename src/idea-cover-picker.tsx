import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus } from "lucide-react";
import {
  CoverPickerSheet,
  type CoverPickerOption,
  type CoverSource,
} from "./cover-picker";
import { validateCoverFile } from "./cover-storage";
import {
  getIdeaCoverPreset,
  IDEA_COVER_PRESETS_BY_CATEGORY,
  isIdeaCoverPresetId,
  resolveIdeaCoverPreset,
  type IdeaCoverPresetId,
} from "./idea-covers";
import type { Idea } from "./types";

type IdeaAutomaticCover = "automatic" | IdeaCoverPresetId;

export type IdeaCoverSelection = {
  coverPresetId?: IdeaCoverPresetId;
  optionalImage?: string;
  coverStoragePath?: string;
  coverUrl?: string;
  uploadFile?: File;
};

export function IdeaCoverPicker({
  idea,
  onClose,
  onSave,
}: {
  idea: Pick<
    Idea,
    | "id"
    | "category"
    | "title"
    | "description"
    | "tags"
    | "isDateNight"
    | "coverPresetId"
    | "optionalImage"
    | "coverStoragePath"
    | "coverUrl"
    | "pendingCoverFile"
  >;
  onClose: () => void;
  onSave: (selection: IdeaCoverSelection) => Promise<void>;
}) {
  const validCurrent = isIdeaCoverPresetId(idea.coverPresetId)
    ? idea.coverPresetId
    : undefined;
  const initialSource: CoverSource = idea.coverStoragePath || idea.pendingCoverFile
    ? "upload"
    : idea.optionalImage
      ? "url"
      : "automatic";
  const initialAutomaticCover: IdeaAutomaticCover = validCurrent ?? "automatic";
  const [source, setSource] = useState<CoverSource>(initialSource);
  const [automaticCover, setAutomaticCover] =
    useState<IdeaAutomaticCover>(initialAutomaticCover);
  const [externalUrl, setExternalUrl] = useState(idea.optionalImage ?? "");
  const [externalValid, setExternalValid] = useState(Boolean(idea.optionalImage));
  const [uploadFile, setUploadFile] = useState<File | undefined>(idea.pendingCoverFile);
  const [uploadPreview, setUploadPreview] = useState<string | undefined>(() =>
    idea.pendingCoverFile ? URL.createObjectURL(idea.pendingCoverFile) : undefined,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const automaticPreset = resolveIdeaCoverPreset({ ...idea, coverPresetId: null });
  const options = useMemo(() => {
    const categoryPresets = IDEA_COVER_PRESETS_BY_CATEGORY[idea.category];
    const currentPreset = validCurrent ? getIdeaCoverPreset(validCurrent) : undefined;
    const visiblePresets = currentPreset && currentPreset.category !== idea.category
      ? [currentPreset, ...categoryPresets]
      : categoryPresets;
    return visiblePresets.map<CoverPickerOption<IdeaCoverPresetId>>((preset) => ({
      value: preset.id,
      label: preset.id === validCurrent && preset.category !== idea.category
        ? `${preset.label} · Current`
        : preset.label,
      source: preset.path,
      ariaLabel: `Use ${preset.label} cover`,
    }));
  }, [idea.category, validCurrent]);

  useEffect(() => {
    return () => { if (uploadPreview) URL.revokeObjectURL(uploadPreview); };
  }, [uploadPreview]);

  useEffect(() => {
    const trimmed = externalUrl.trim();
    if (source !== "url" || !/^https?:\/\//i.test(trimmed)) return;
    let active = true;
    const image = new Image();
    image.onload = () => { if (active) setExternalValid(true); };
    image.onerror = () => { if (active) setExternalValid(false); };
    image.src = trimmed;
    return () => { active = false; };
  }, [externalUrl, source]);

  const selectedPreset = automaticCover !== "automatic"
    ? getIdeaCoverPreset(automaticCover)
    : automaticPreset;
  const previewSource = source === "upload"
    ? uploadPreview || idea.coverUrl || selectedPreset.path
    : source === "url" && /^https?:\/\//i.test(externalUrl.trim())
      ? externalUrl.trim()
      : selectedPreset.path;
  const initialExternal = idea.optionalImage?.trim() ?? "";
  const invalidCurrent = Boolean(
    idea.coverPresetId && !isIdeaCoverPresetId(idea.coverPresetId),
  );
  const dirty = source !== initialSource ||
    (source === "automatic" && automaticCover !== initialAutomaticCover) ||
    (source === "url" && externalUrl.trim() !== initialExternal) ||
    Boolean(uploadFile && uploadFile !== idea.pendingCoverFile) || invalidCurrent;
  const canSave = !saving && dirty &&
    (source !== "url" || externalValid) &&
    (source !== "upload" || Boolean(uploadFile || idea.coverStoragePath));

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      validateCoverFile(file);
      setUploadFile(file);
      setUploadPreview(URL.createObjectURL(file));
      setSource("upload");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Choose another image.");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (source === "upload") {
        await onSave(uploadFile
          ? { uploadFile }
          : {
              coverStoragePath: idea.coverStoragePath,
              coverUrl: idea.coverUrl,
            });
      } else if (source === "url") {
        await onSave({ optionalImage: externalUrl.trim() });
      } else if (automaticCover === "automatic") {
        await onSave({});
      } else {
        await onSave({ coverPresetId: automaticCover });
      }
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error
        ? nextError.message
        : "We could not update this idea cover.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CoverPickerSheet
      title="Change cover"
      previewSource={previewSource}
      previewAlt="Idea cover preview"
      fallbackSource={getIdeaCoverPreset("general-default").path}
      sectionTitle="Idea covers"
      sectionDescription="Choose a library cover, external image, or your own photo."
      automaticDescription="Uses this idea’s category, details, and stable ID."
      automaticSelected={automaticCover === "automatic"}
      options={options}
      choicesAriaLabel="Idea cover choices"
      selectedValue={automaticCover === "automatic" ? undefined : automaticCover}
      source={source}
      saving={saving}
      canSave={canSave}
      error={error}
      onSelectSource={(nextSource) => { setSource(nextSource); setError(null); }}
      onSelectAutomatic={() => { setAutomaticCover("automatic"); setError(null); }}
      onSelectOption={(value) => { setAutomaticCover(value); setError(null); }}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
    >
      {source === "upload" && <div className="cover-source-content">
        <div className="cover-upload-controls">
        <label className="cover-upload-button">
          <ImagePlus aria-hidden="true" />
          {idea.coverStoragePath || uploadFile ? "Replace photo" : "Upload photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={chooseFile}
            disabled={saving}
          />
        </label>
        {(idea.coverStoragePath || uploadFile) && (
          <button type="button" className="text-action" onClick={() => {
            setUploadFile(undefined);
            setUploadPreview(undefined);
            setSource("automatic");
            setError(null);
          }}>Remove photo</button>
        )}
        </div>
        <small>JPEG, PNG, or WebP. Photos are resized before upload; maximum source size 10 MB.</small>
      </div>}
      {source === "url" && <div className="cover-source-content">
        <label className="cover-custom-url">
        External image URL
        <input
          type="url"
          value={externalUrl}
          onChange={(event) => {
            setExternalUrl(event.target.value);
            setExternalValid(false);
            setError(null);
          }}
          placeholder="https://example.com/idea.jpg"
          aria-invalid={Boolean(externalUrl.trim()) && !externalValid}
        />
        </label>
        <small>Paste a direct http(s) image URL. The image must load successfully before saving.</small>
      </div>}
    </CoverPickerSheet>
  );
}
