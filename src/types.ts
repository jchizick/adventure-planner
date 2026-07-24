import type { Category } from "./idea-model";

export type IdeaStatus = "Idea" | "Tentative" | "Confirmed";
export type AdventureStatus = "Tentative" | "Confirmed" | "Completed";
export type AdventureCoverVariant = 1 | 2 | 3;
export type AdventureCoverSelection = {
  coverImage?: string;
  coverVariant?: AdventureCoverVariant;
  coverStoragePath?: string;
  coverUrl?: string;
  uploadFile?: File;
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
  proposedStartDate?: string;
  proposedStartTime?: string;
  proposedEndDate?: string;
  proposedEndTime?: string;
  spaceId?: string;
  createdAt: string;
  updatedAt?: string;
  optionalLink?: string;
  optionalImage?: string;
  coverPresetId?: string;
  coverStoragePath?: string;
  coverUrl?: string;
  pendingCoverFile?: File;
  optionalLocation?: string;
  linkedAdventureId?: string;
}
export interface AdventureStop {
  id: string;
  title: string;
  dayDate: string;
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
  endDate?: string;
  startTime: string;
  endTime: string;
  status: AdventureStatus;
  coverImage?: string;
  coverVariant?: AdventureCoverVariant;
  coverStoragePath?: string;
  coverUrl?: string;
  location: string;
  savedLocation: SavedLocation;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  geocodedLocation?: string;
  locationWeatherWarning?: string;
  category?: Category;
  tags: string[];
  sourceIdeaId?: string;
  stops: AdventureStop[];
  notes: string;
  links: AdventureLink[];
  checklist: ChecklistItem[];
  addedBy: string;
  updatedBy: string;
  updatedAt?: string;
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
export type AdventureRatingScore = 1 | 2 | 3 | 4 | 5;
export interface AdventureRating {
  id: string;
  adventureId: string;
  userId: string | null;
  rating: AdventureRatingScore;
  wouldDoAgain: boolean | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface AdventureRatingWithMember extends AdventureRating {
  memberName: string;
  memberAvatarUrl: string | null;
}
export interface AdventureRatingSummary {
  average: number | null;
  count: number;
  wouldDoAgainYes: number;
  wouldDoAgainNo: number;
  wouldDoAgainUnanswered: number;
}
export interface MemorySummary {
  adventureId: string;
  reflection: string;
  photoCount: number;
  coverUrl?: string;
  rating: AdventureRatingSummary;
}
export interface CalendarEvent {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  originalDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  category: Category;
  status: AdventureStatus | IdeaStatus;
  kind?: "adventure" | "proposal";
  adventureId?: string;
  ideaId?: string;
  allDay?: boolean;
}
export interface AdventurePlanInput {
  title: string;
  description: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  status: Extract<IdeaStatus, "Tentative" | "Confirmed">;
  location: string;
  locationDraft?: LocationDraft;
  notes: string;
  category?: Category;
  tags: string[];
  coverImage?: string;
  coverVariant?: AdventureCoverVariant;
  coverStoragePath?: string;
  coverUrl?: string;
  coverUploadFile?: File;
}
