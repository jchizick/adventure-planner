export type IdeaStatus = "Idea" | "Tentative" | "Confirmed";
export type AdventureStatus = "Tentative" | "Confirmed" | "Completed";
export type Category =
  | "Dates"
  | "Food"
  | "Concerts"
  | "Outdoors"
  | "Camping & Travel"
  | "Culture"
  | "Errands"
  | "At Home";
export interface Idea {
  id: string;
  title: string;
  description: string;
  category: Category;
  status: IdeaStatus;
  tags: string[];
  addedBy: string;
  addedById?: string;
  spaceId?: string;
  createdAt: string;
  updatedAt?: string;
  optionalLink?: string;
  optionalImage?: string;
  optionalLocation?: string;
  linkedAdventureId?: string;
}
export interface AdventureStop {
  id: string;
  title: string;
  location: string;
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
}
export interface AdventureLink {
  id: string;
  label: string;
  url: string;
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
  location: string;
  category?: Category;
  sourceIdeaId?: string;
  stops: AdventureStop[];
  notes: string;
  links: AdventureLink[];
  checklist: ChecklistItem[];
  addedBy: string;
  updatedBy: string;
  completed: boolean;
  favorite: boolean;
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
  notes: string;
  category?: Category;
  coverImage?: string;
}
