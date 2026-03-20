"use client";

import type {
  Accomplishment,
  CompetencyCategory,
  CompetencyLevel,
  DraftLinks,
  FrameworkItem,
  ItemKind,
  SuggestedMatch
} from "./types";

function createId() {
  return crypto.randomUUID();
}

export function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseList(raw: string, kind: ItemKind): FrameworkItem[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(":");
      return {
        id: createId(),
        name: name.trim(),
        description: rest.join(":").trim(),
        kind
      };
    });
}

export function flattenCompetencyCategories(categories: CompetencyCategory[]): FrameworkItem[] {
  return categories.flatMap((category) =>
    category.competencies.map((competency) => ({
      id: competency.id,
      name: competency.name,
      description: competency.description,
      kind: "competency" as const,
      categoryId: category.id,
      categoryName: category.name
    }))
  );
}

export function serializeCompetencyCategories(categories: CompetencyCategory[]) {
  return categories
    .map((category) => {
      const lines = category.competencies.map((competency) =>
        competency.description
          ? `- ${competency.name}: ${competency.description}`
          : `- ${competency.name}`
      );

      return [category.name, ...lines].join("\n");
    })
    .join("\n\n");
}

export function parseLegacyCompetencies(raw: string): CompetencyCategory[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  return [
    {
      id: crypto.randomUUID(),
      name: "Core competencies",
      competencies: lines.map((line) => {
        const [name, ...rest] = line.split(":");

        return {
          id: crypto.randomUUID(),
          name: name.trim(),
          description: rest.join(":").trim()
        };
      })
    }
  ];
}

export function getDefaultCompetencyLevel(): CompetencyLevel {
  return "L1";
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2);
}

function jaccardSimilarity(a: string[], b: string[]) {
  const left = new Set(a);
  const right = new Set(b);

  if (!left.size || !right.size) {
    return 0;
  }

  let intersection = 0;

  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

export function findSuggestedMatch(
  text: string,
  accomplishments: Accomplishment[]
): SuggestedMatch | null {
  const candidateTokens = tokenize(text);
  const recentCutoff = Date.now() - 1000 * 60 * 60 * 24 * 14;
  let bestMatch: SuggestedMatch | null = null;
  let bestScore = 0;

  for (const accomplishment of accomplishments) {
    const created = new Date(accomplishment.createdAt).getTime();

    if (Number.isNaN(created) || created < recentCutoff) {
      continue;
    }

    const score = jaccardSimilarity(candidateTokens, tokenize(accomplishment.text));

    if (score >= 0.34 && score > bestScore) {
      bestScore = score;
      bestMatch = {
        accomplishmentId: accomplishment.id,
        reason: `Similar wording and focus to "${accomplishment.text}".`
      };
    }
  }

  return bestMatch;
}

export function classifyAccomplishment(text: string, framework: FrameworkItem[]) {
  const normalized = normalizeText(text);
  const tokens = tokenize(text);
  const scored = framework
    .map((item) => {
      const haystack = `${item.name} ${item.description}`.trim();
      const itemTokens = tokenize(haystack);
      const tokenScore = jaccardSimilarity(tokens, itemTokens);
      const directNameHit = normalized.includes(normalizeText(item.name)) ? 0.45 : 0;
      const score = tokenScore + directNameHit;

      return {
        id: item.id,
        kind: item.kind,
        score
      };
    })
    .filter((item) => item.score > 0.18)
    .sort((a, b) => b.score - a.score);

  const goals = scored
    .filter((item) => item.kind === "goal")
    .slice(0, 2)
    .map((item) => item.id);
  const competencies = scored
    .filter((item) => item.kind === "competency")
    .slice(0, 2)
    .map((item) => item.id);

  return { goals, competencies };
}

export function formatFriendlyDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

export function formatAssistantNote(
  links: DraftLinks,
  framework: FrameworkItem[],
  count: number,
  aggregated: boolean
) {
  const names = framework
    .filter((item) => [...links.goals, ...links.competencies].includes(item.id))
    .map((item) => `${item.kind === "goal" ? "Goal" : "Competency"}: ${item.name}`);

  const categoryText = names.length ? names.join(" | ") : "Awaiting goal/competency setup";

  if (aggregated) {
    return `Recorded and aggregated. This is occurrence ${count}. ${categoryText}.`;
  }

  return `Recorded. Categorized as ${categoryText}.`;
}
