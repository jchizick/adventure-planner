export type IdeaStatus = "Idea" | "Tentative" | "Confirmed";
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
  addedBy: "Jordan" | "Liz";
  createdAt: string;
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
  status: IdeaStatus;
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
  status: IdeaStatus;
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
}
