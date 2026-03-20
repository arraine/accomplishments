export type ItemKind = "goal" | "competency";
export type SummaryFilter = "all" | "goal" | "competency";

export type FrameworkItem = {
  id: string;
  name: string;
  description: string;
  kind: ItemKind;
};

export type Accomplishment = {
  id: string;
  createdAt: string;
  date: string;
  text: string;
  normalized: string;
  links: string[];
  count: number;
  history: string[];
  assistantNote: string;
};

export type DraftLinks = {
  goals: string[];
  competencies: string[];
};

export type SuggestedMatch = {
  accomplishmentId: string;
  reason: string;
};

export type StoredState = {
  framework: FrameworkItem[];
  accomplishments: Accomplishment[];
  draftGoals: string;
  draftCompetencies: string;
};
