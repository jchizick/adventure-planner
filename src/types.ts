import type { Category } from "./idea-model";

export type IdeaStatus = "Idea" | "Tentative" | "Confirmed";
export type AdventureStatus = "Tentative" | "Confirmed" | "Completed";
export type AdventureCoverVariant = 1 | 2 | 3;
export type AdventureCoverSelection = {
  coverImage?: string;
  coverVariant?: AdventureCoverVariant;
};
export type NormalizedAddress = {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  county?: string;
  region?: string;
  regionCode?: string;
  postcode?: string;
  country?: string;
  countryCode?: string;
};
export type LocationSource = {
  name: string;
  attribution: string;
  license?: string;
  url?: string;
};
export type LocationCandidate = {
  provider: string;
  providerPlaceId: string;
  label: string;
  formattedAddress: string;
  address: NormalizedAddress;
  source: LocationSource;
  latitude: number;
  longitude: number;
  timezone?: string;
};
export type SavedLocation =
  | { kind: "none"; label: "" }
  | { kind: "text"; label: string }
  | {
      kind: "legacy";
      label: string;
      latitude: number;
      longitude: number;
      timezone?: string;
      formattedAddress?: string;
    }
  | {
      kind: "confirmed";
      label: string;
      candidate: LocationCandidate;
      confirmedAt: string;
    };
export type LocationDraft = {
  label: string;
  intent: "preserve" | "selected" | "text-only" | "clear";
  candidate?: LocationCandidate;
};
export type { Category } from "./idea-model";
export interface Idea {
  id: string;
  title: string;
  description: string;
  category: Category;
  status: IdeaStatus;
  tags: string[];
  addedBy: string;
  addedByUserId?: string;
  isDateNight: boolean;
  scheduledFor?: string;
  spaceId?: string;
  createdAt: string;
  updatedAt?: string;
  optionalLink?: string;
  optionalImage?: string;
  coverPresetId?: string;
  optionalLocation?: string;
  linkedAdventureId?: string;
}
export interface AdventureStop {
  id: string;
  title: string;
  location: string;
  savedLocation: SavedLocation;
  startTime: string;
  endTime?: string;
  notes?: string;
  sortOrder: number;
  optionalTravelTime?: string;
}
export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  sortOrder: number;
  createdBy: string;
}
export interface AdventureLink {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
}
export interface Adventure {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AdventureStatus;
  coverImage?: string;
  coverVariant?: AdventureCoverVariant;
  location: string;
  savedLocation: SavedLocation;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  geocodedLocation?: string;
  locationWeatherWarning?: string;
  category?: Category;
  sourceIdeaId?: string;
  stops: AdventureStop[];
  notes: string;
  links: AdventureLink[];
  checklist: ChecklistItem[];
  addedBy: string;
  updatedBy: string;
  completed: boolean;
  completedAt?: string;
  favorite: boolean;
}
export interface MemoryPhoto {
  id: string;
  adventureId: string;
  uploadedByUserId: string;
  uploadedBy: string;
  storagePath: string;
  caption?: string;
  sortOrder: number;
  createdAt: string;
  width?: number;
  height?: number;
  fileSize: number;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  url: string;
}
export interface AdventureMemory {
  id?: string;
  adventureId: string;
  reflection: string;
  updatedBy?: string;
  updatedAt?: string;
  photos: MemoryPhoto[];
}
export interface MemorySummary {
  adventureId: string;
  reflection: string;
  photoCount: number;
  coverUrl?: string;
}
export interface CalendarEvent {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  startTime?: string;
  endTime?: string;
  category: Category;
  status: AdventureStatus;
  adventureId?: string;
  allDay?: boolean;
}
export interface AdventurePlanInput {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  status: Extract<IdeaStatus, "Tentative" | "Confirmed">;
  location: string;
  locationDraft?: LocationDraft;
  notes: string;
  category?: Category;
  coverImage?: string;
  coverVariant?: AdventureCoverVariant;
}
