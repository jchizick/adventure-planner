import {
  Check,
  CloudRain,
  Heart,
  Leaf,
  PawPrint,
  Repeat2,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  curatedTags,
  normalizeTagSlugs,
  tagDefinition,
  toggleTag,
  type TagIconKey,
} from "./tag-model";

const tagIcons: Record<TagIconKey, LucideIcon> = {
  heart: Heart,
  users: Users,
  "paw-print": PawPrint,
  leaf: Leaf,
  "cloud-rain": CloudRain,
  repeat: Repeat2,
};

export function TagSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: readonly string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(normalizeTagSlugs(value));
  return (
    <fieldset className="tag-selector">
      <legend>Tags <span>Optional</span></legend>
      <div className="tag-selector-options">
        {curatedTags.map((tag) => {
          const Icon = tagIcons[tag.iconKey];
          const active = selected.has(tag.slug);
          return (
            <button
              type="button"
              className={active ? "selected" : undefined}
              key={tag.id}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(toggleTag(value, tag.slug))}
            >
              <Icon aria-hidden="true" />
              <span>{tag.label}</span>
              {active && <Check className="tag-selected-check" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function TagList({
  tags,
  limit,
  className,
}: {
  tags: readonly string[];
  limit?: number;
  className?: string;
}) {
  const normalized = normalizeTagSlugs(tags);
  const visible = limit === undefined ? normalized : normalized.slice(0, limit);
  const overflow = limit === undefined ? 0 : Math.max(0, normalized.length - visible.length);
  if (!visible.length) return null;
  return (
    <span className={["tag-list", className].filter(Boolean).join(" ")}>
      {visible.map((slug) => {
        const tag = tagDefinition(slug);
        if (!tag) return null;
        const Icon = tagIcons[tag.iconKey];
        return (
          <span className="tag-chip" key={tag.id}>
            <Icon aria-hidden="true" />
            <span>{tag.label}</span>
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="tag-chip tag-overflow" aria-label={`${overflow} more tags`}>
          +{overflow}
        </span>
      )}
    </span>
  );
}
