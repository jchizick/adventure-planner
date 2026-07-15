import {
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";
import { SafeImage, Sheet } from "./components";

export type CoverPickerOption<Value extends string | number> = {
  value: Value;
  label: string;
  source: string;
  ariaLabel: string;
};

export function CoverPickerSheet<Value extends string | number>({
  title,
  previewSource,
  previewAlt,
  fallbackSource,
  sectionTitle,
  sectionDescription,
  automaticDescription,
  automaticSelected,
  options,
  choicesAriaLabel = "Cover choices",
  selectedValue,
  saving,
  canSave,
  error,
  children,
  onSelectAutomatic,
  onSelectOption,
  onClose,
  onSubmit,
}: {
  title: string;
  previewSource: string;
  previewAlt: string;
  fallbackSource: string;
  sectionTitle: string;
  sectionDescription: string;
  automaticDescription: string;
  automaticSelected: boolean;
  options: readonly CoverPickerOption<Value>[];
  choicesAriaLabel?: string;
  selectedValue?: Value;
  saving: boolean;
  canSave: boolean;
  error?: string | null;
  children?: ReactNode;
  onSelectAutomatic: () => void;
  onSelectOption: (value: Value) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const headingId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCloseRef.current();
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, []);

  return (
    <Sheet open title={title} onClose={onClose}>
      <form className="cover-photo-form" onSubmit={onSubmit} noValidate>
        <p className="cover-photo-section-title">Current preview</p>
        <SafeImage
          src={previewSource}
          fallbackSrc={fallbackSource}
          alt={previewAlt}
          width={1600}
          height={800}
        />
        <section className="cover-photo-options" aria-labelledby={headingId}>
          <div>
            <h3 id={headingId}>{sectionTitle}</h3>
            <small>{sectionDescription}</small>
          </div>
          <button
            type="button"
            className="cover-auto-option"
            aria-pressed={automaticSelected}
            onClick={onSelectAutomatic}
          >
            <span>
              <strong>Automatic</strong>
              <small>{automaticDescription}</small>
            </span>
            {automaticSelected && <Check aria-hidden="true" />}
          </button>
          <div className="cover-variant-row" aria-label={choicesAriaLabel}>
            {options.map((option) => {
              const selected = selectedValue === option.value;
              return (
                <button
                  type="button"
                  className="cover-variant-option"
                  aria-label={option.ariaLabel}
                  aria-pressed={selected}
                  key={option.value}
                  onClick={() => onSelectOption(option.value)}
                >
                  <SafeImage
                    src={option.source}
                    fallbackSrc={fallbackSource}
                    alt=""
                    width={1600}
                    height={800}
                  />
                  <span>{option.label}</span>
                  {selected && (
                    <Check className="cover-option-check" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
        {children}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="sheet-actions">
          <button
            className="secondary"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button className="primary" type="submit" disabled={!canSave}>
            {saving ? "Saving…" : "Save cover"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
