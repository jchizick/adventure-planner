import { useMemo, useState, type FormEvent } from "react";
import { CoverPickerSheet, type CoverPickerOption } from "./cover-picker";
import {
  getIdeaCoverPreset,
  IDEA_COVER_PRESETS_BY_CATEGORY,
  isIdeaCoverPresetId,
  resolveIdeaCoverPreset,
  type IdeaCoverPresetId,
} from "./idea-covers";
import type { Idea } from "./types";

type IdeaCoverMode = "automatic" | IdeaCoverPresetId;

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
    | "isDateNight"
    | "coverPresetId"
  >;
  onClose: () => void;
  onSave: (coverPresetId?: IdeaCoverPresetId) => Promise<void>;
}) {
  const validCurrent = isIdeaCoverPresetId(idea.coverPresetId)
    ? idea.coverPresetId
    : undefined;
  const initialMode: IdeaCoverMode = validCurrent ?? "automatic";
  const [mode, setMode] = useState<IdeaCoverMode>(initialMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const automaticPreset = resolveIdeaCoverPreset({
    ...idea,
    coverPresetId: null,
  });
  const options = useMemo(() => {
    const categoryPresets = IDEA_COVER_PRESETS_BY_CATEGORY[idea.category];
    const currentPreset = validCurrent
      ? getIdeaCoverPreset(validCurrent)
      : undefined;
    const visiblePresets = currentPreset && currentPreset.category !== idea.category
      ? [currentPreset, ...categoryPresets]
      : categoryPresets;
    return visiblePresets.map<CoverPickerOption<IdeaCoverPresetId>>(
      (preset) => ({
        value: preset.id,
        label:
          preset.id === validCurrent && preset.category !== idea.category
            ? `${preset.label} · Current`
            : preset.label,
        source: preset.path,
        ariaLabel: `Use ${preset.label} cover`,
      }),
    );
  }, [idea.category, validCurrent]);
  const selectedPreset = mode === "automatic"
    ? automaticPreset
    : getIdeaCoverPreset(mode);
  const invalidCurrent = Boolean(
    idea.coverPresetId && !isIdeaCoverPresetId(idea.coverPresetId),
  );
  const canSave = !saving && (mode !== initialMode || invalidCurrent);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(mode === "automatic" ? undefined : mode);
      onClose();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We could not update this idea cover.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <CoverPickerSheet
      title="Change cover"
      previewSource={selectedPreset.path}
      previewAlt="Idea cover preview"
      fallbackSource={getIdeaCoverPreset("general-default").path}
      sectionTitle="Idea covers"
      sectionDescription="Choose a cover for this idea, or use its stable automatic cover."
      automaticDescription="Uses this idea’s category, details, and stable ID."
      automaticSelected={mode === "automatic"}
      options={options}
      choicesAriaLabel="Idea cover choices"
      selectedValue={mode === "automatic" ? undefined : mode}
      saving={saving}
      canSave={canSave}
      error={error}
      onSelectAutomatic={() => {
        setMode("automatic");
        setError(null);
      }}
      onSelectOption={(value) => {
        setMode(value);
        setError(null);
      }}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
    />
  );
}
