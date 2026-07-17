import { SafeImage } from "./components";
import { getIdeaCoverPreset, resolveIdeaCoverPreset } from "./idea-covers";
import type { Idea } from "./types";

export function IdeaCoverThumbnail({
  idea,
  size,
  className,
}: {
  idea: Pick<
    Idea,
    | "id"
    | "category"
    | "title"
    | "description"
    | "isDateNight"
    | "coverPresetId"
    | "optionalImage"
    | "coverUrl"
  >;
  size: 52 | 58 | 64;
  className?: string;
}) {
  const preset = resolveIdeaCoverPreset(idea);
  const customSource = idea.coverUrl?.trim() || idea.optionalImage?.trim();
  return (
    <div
      className={["idea-cover-thumbnail", className].filter(Boolean).join(" ")}
      data-idea-cover-preset={customSource ? undefined : preset.id}
      style={{ width: size, height: size }}
    >
      <SafeImage
        src={customSource || preset.path}
        fallbackSrc={getIdeaCoverPreset("general-default").path}
        alt=""
        loading="lazy"
        decoding="async"
        width={size}
        height={size}
      />
    </div>
  );
}
