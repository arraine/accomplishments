export type ItemKind = "goal" | "competency";
export type SummaryFilter = "all" | "goal" | "competency";
export type CompetencyLevel = "L1" | "L2" | "L3";

export type CompetencyDefinition = {
  id: string;
  name: string;
  description: string;
};

export type CompetencyCategory = {
  id: string;
  name: string;
  competencies: CompetencyDefinition[];
};

export type KeyResult = {
  id: string;
  text: string;
};

export type GoalObjective = {
  id: string;
  objective: string;
  description: string;
  keyResults: KeyResult[];
};

export type FrameworkItem = {
  id: string;
  name: string;
  description: string;
  kind: ItemKind;
  categoryId?: string;
  categoryName?: string;
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
  goalObjectives?: GoalObjective[];
  draftCompetencies?: string;
  competencyLevel?: CompetencyLevel;
  competencyCategories?: CompetencyCategory[];
};

export type LlmCategorizationResult = {
  assistantNote: string;
  suggestedGoalIds: string[];
  suggestedCompetencyIds: string[];
};
