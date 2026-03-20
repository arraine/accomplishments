"use client";

import { useEffect, useMemo, useState } from "react";

type ItemKind = "goal" | "competency";
type SummaryFilter = "all" | "goal" | "competency";

type FrameworkItem = {
  id: string;
  name: string;
  description: string;
  kind: ItemKind;
};

type Accomplishment = {
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

type DraftLinks = {
  goals: string[];
  competencies: string[];
};

type SuggestedMatch = {
  accomplishmentId: string;
  reason: string;
};

type StoredState = {
  framework: FrameworkItem[];
  accomplishments: Accomplishment[];
  draftGoals: string;
  draftCompetencies: string;
};

const STORAGE_KEY = "accomplishments-assistant-v1";

const seededGoals = [
  "Build trust with cross-functional partners",
  "Drive projects through ambiguity",
  "Create visible impact for the business"
].join("\n");

const seededCompetencies = [
  "Communication",
  "Execution",
  "Technical judgment",
  "Ownership"
].join("\n");

function createId() {
  return crypto.randomUUID();
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseList(raw: string, kind: ItemKind): FrameworkItem[] {
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

function normalizeText(value: string) {
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

function findSuggestedMatch(text: string, accomplishments: Accomplishment[]): SuggestedMatch | null {
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

function classifyAccomplishment(text: string, framework: FrameworkItem[]) {
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

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1).getTime();
}

function formatFriendlyDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function formatAssistantNote(
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

function seedState(): StoredState {
  const framework = [
    ...parseList(seededGoals, "goal"),
    ...parseList(seededCompetencies, "competency")
  ];

  const firstLinks = classifyAccomplishment(
    "Resolved three IDM support cases independently and documented the fixes.",
    framework
  );
  const secondLinks = classifyAccomplishment(
    "Presented a concise project update that aligned engineering and operations on launch risk.",
    framework
  );

  return {
    framework,
    draftGoals: seededGoals,
    draftCompetencies: seededCompetencies,
    accomplishments: [
      {
        id: createId(),
        createdAt: "2026-03-18T18:30:00.000Z",
        date: "2026-03-18",
        text: "Resolved three IDM support cases independently and documented the fixes.",
        normalized: normalizeText(
          "Resolved three IDM support cases independently and documented the fixes."
        ),
        links: [...firstLinks.goals, ...firstLinks.competencies],
        count: 3,
        history: [
          "Resolved an IDM case without escalation.",
          "Solved a second IDM case and captured the root cause.",
          "Documented the fix pattern for future cases."
        ],
        assistantNote: formatAssistantNote(firstLinks, framework, 3, true)
      },
      {
        id: createId(),
        createdAt: "2026-03-19T20:00:00.000Z",
        date: "2026-03-19",
        text: "Presented a concise project update that aligned engineering and operations on launch risk.",
        normalized: normalizeText(
          "Presented a concise project update that aligned engineering and operations on launch risk."
        ),
        links: [...secondLinks.goals, ...secondLinks.competencies],
        count: 1,
        history: [
          "Presented a concise project update that aligned engineering and operations on launch risk."
        ],
        assistantNote: formatAssistantNote(secondLinks, framework, 1, false)
      }
    ]
  };
}

export default function Home() {
  const today = getTodayString();
  const [framework, setFramework] = useState<FrameworkItem[]>([]);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [draftGoals, setDraftGoals] = useState(seededGoals);
  const [draftCompetencies, setDraftCompetencies] = useState(seededCompetencies);
  const [entryText, setEntryText] = useState("");
  const [entryDate, setEntryDate] = useState(today);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  const [message, setMessage] = useState(
    "Acting as your accomplishments assistant. Define goals and competencies, then log daily impact with categorization and year-to-date summaries."
  );
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>("all");
  const [summaryItemId, setSummaryItemId] = useState("all");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      const initial = seedState();
      setFramework(initial.framework);
      setAccomplishments(initial.accomplishments);
      return;
    }

    const parsed = JSON.parse(saved) as StoredState;
    setFramework(parsed.framework);
    setAccomplishments(parsed.accomplishments);
    setDraftGoals(parsed.draftGoals);
    setDraftCompetencies(parsed.draftCompetencies);
  }, []);

  useEffect(() => {
    if (!framework.length && !accomplishments.length) {
      return;
    }

    const state: StoredState = {
      framework,
      accomplishments,
      draftGoals,
      draftCompetencies
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [framework, accomplishments, draftGoals, draftCompetencies]);

  const goals = framework.filter((item) => item.kind === "goal");
  const competencies = framework.filter((item) => item.kind === "competency");

  const currentYearAccomplishments = useMemo(() => {
    const todayTime = new Date(`${today}T12:00:00`).getTime();
    const yearStart = startOfYear(new Date(`${today}T12:00:00`));

    return accomplishments.filter((item) => {
      const itemTime = new Date(`${item.date}T12:00:00`).getTime();
      return itemTime >= yearStart && itemTime <= todayTime;
    });
  }, [accomplishments, today]);

  const groupedSummary = useMemo(() => {
    const activeItems =
      summaryFilter === "goal"
        ? goals
        : summaryFilter === "competency"
          ? competencies
          : framework;

    return activeItems
      .filter((item) => summaryItemId === "all" || item.id === summaryItemId)
      .map((item) => ({
        item,
        accomplishments: currentYearAccomplishments.filter((accomplishment) =>
          accomplishment.links.includes(item.id)
        )
      }))
      .filter((group) => group.accomplishments.length > 0);
  }, [
    competencies,
    currentYearAccomplishments,
    framework,
    goals,
    summaryFilter,
    summaryItemId
  ]);

  const dashboardStats = useMemo(() => {
    const totalCount = accomplishments.reduce((sum, item) => sum + item.count, 0);
    const linkedCount = accomplishments.filter((item) => item.links.length > 0).length;

    return {
      entries: accomplishments.length,
      totalCount,
      goalsCovered: new Set(accomplishments.flatMap((item) => item.links.filter((id) => goals.some((goal) => goal.id === id)))).size,
      linkedCount
    };
  }, [accomplishments, goals]);

  function saveFramework() {
    const nextFramework = [
      ...parseList(draftGoals, "goal"),
      ...parseList(draftCompetencies, "competency")
    ];

    setFramework(nextFramework);
    setSummaryItemId("all");
    setSelectedGoals([]);
    setSelectedCompetencies([]);
    setMessage(
      nextFramework.length
        ? "Framework stored. New accomplishments will now be categorized against your goals and competencies."
        : "Accomplishments can still be recorded, but they will remain uncategorized until the framework is defined."
    );
  }

  function toggleSelection(id: string, kind: ItemKind) {
    if (kind === "goal") {
      setSelectedGoals((current) =>
        current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
      );
      return;
    }

    setSelectedCompetencies((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  function handleEntrySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = entryText.trim();

    if (!trimmed) {
      return;
    }

    const suggested = framework.length ? classifyAccomplishment(trimmed, framework) : null;
    const draftLinks: DraftLinks = {
      goals: selectedGoals.length ? selectedGoals : suggested?.goals ?? [],
      competencies: selectedCompetencies.length
        ? selectedCompetencies
        : suggested?.competencies ?? []
    };
    const suggestedMatch = findSuggestedMatch(trimmed, accomplishments);

    if (suggestedMatch) {
      setAccomplishments((current) =>
        current.map((item) => {
          if (item.id !== suggestedMatch.accomplishmentId) {
            return item;
          }

          const nextCount = item.count + 1;
          const combinedLinks = Array.from(new Set([...item.links, ...draftLinks.goals, ...draftLinks.competencies]));

          return {
            ...item,
            date: entryDate,
            createdAt: new Date(`${entryDate}T12:00:00`).toISOString(),
            links: combinedLinks,
            count: nextCount,
            history: [...item.history, trimmed],
            assistantNote: formatAssistantNote(
              {
                goals: combinedLinks.filter((id) => goals.some((goal) => goal.id === id)),
                competencies: combinedLinks.filter((id) =>
                  competencies.some((competency) => competency.id === id)
                )
              },
              framework,
              nextCount,
              true
            )
          };
        })
      );
      setMessage(
        `Logged and aggregated with a recent entry. ${suggestedMatch.reason} Occurrence count increased.`
      );
    } else {
      const links = [...draftLinks.goals, ...draftLinks.competencies];
      const newEntry: Accomplishment = {
        id: createId(),
        createdAt: new Date(`${entryDate}T12:00:00`).toISOString(),
        date: entryDate,
        text: trimmed,
        normalized: normalizeText(trimmed),
        links,
        count: 1,
        history: [trimmed],
        assistantNote: formatAssistantNote(draftLinks, framework, 1, false)
      };

      setAccomplishments((current) => [newEntry, ...current]);
      setMessage(newEntry.assistantNote);
    }

    setEntryText("");
    setSelectedGoals([]);
    setSelectedCompetencies([]);
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy-block">
          <p className="eyebrow">Accomplishments Assistant</p>
          <h1>Track visible daily progress against goals and competencies.</h1>
          <p className="hero-copy">
            Capture accomplishments, group repeated wins into stronger entries, and retrieve a
            current-year summary whenever you need review-ready evidence.
          </p>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span>Tracked entries</span>
            <strong>{dashboardStats.entries}</strong>
          </article>
          <article className="stat-card">
            <span>Total occurrences</span>
            <strong>{dashboardStats.totalCount}</strong>
          </article>
          <article className="stat-card">
            <span>Linked entries</span>
            <strong>{dashboardStats.linkedCount}</strong>
          </article>
          <article className="stat-card">
            <span>Goals covered</span>
            <strong>{dashboardStats.goalsCovered}</strong>
          </article>
        </div>
      </section>

      <section className="assistant-banner">
        <div>
          <p className="assistant-label">Assistant status</p>
          <p className="assistant-message">{message}</p>
        </div>
        <p className="assistant-date">Current log date: {formatFriendlyDate(entryDate)}</p>
      </section>

      <section className="app-grid">
        <div className="panel-stack">
          <article className="panel">
            <div className="panel-heading">
              <h2>Initial setup</h2>
              <p>Define the framework the assistant should use for categorization.</p>
            </div>

            <div className="setup-grid">
              <label>
                Goals
                <textarea
                  value={draftGoals}
                  onChange={(event) => setDraftGoals(event.target.value)}
                  rows={6}
                  placeholder="One goal per line"
                />
              </label>

              <label>
                Competencies
                <textarea
                  value={draftCompetencies}
                  onChange={(event) => setDraftCompetencies(event.target.value)}
                  rows={6}
                  placeholder="One competency per line"
                />
              </label>
            </div>

            <button className="primary-button" type="button" onClick={saveFramework}>
              Save categorization framework
            </button>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h2>Record accomplishment</h2>
              <p>Manual links take priority. If none are selected, the assistant suggests them.</p>
            </div>

            <form className="entry-form" onSubmit={handleEntrySubmit}>
              <label>
                Accomplishment
                <textarea
                  value={entryText}
                  onChange={(event) => setEntryText(event.target.value)}
                  rows={5}
                  placeholder="Example: Led a project risk review that unblocked launch planning."
                />
              </label>

              <label>
                Date
                <input
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                />
              </label>

              <div className="selection-block">
                <p>Suggested links can be overridden here.</p>
                <div className="chip-groups">
                  <div>
                    <span className="group-label">Goals</span>
                    <div className="chip-row">
                      {goals.length ? (
                        goals.map((goal) => (
                          <button
                            key={goal.id}
                            type="button"
                            className={selectedGoals.includes(goal.id) ? "chip active" : "chip"}
                            onClick={() => toggleSelection(goal.id, "goal")}
                          >
                            {goal.name}
                          </button>
                        ))
                      ) : (
                        <span className="empty-inline">No goals yet</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="group-label">Competencies</span>
                    <div className="chip-row">
                      {competencies.length ? (
                        competencies.map((competency) => (
                          <button
                            key={competency.id}
                            type="button"
                            className={
                              selectedCompetencies.includes(competency.id) ? "chip active" : "chip"
                            }
                            onClick={() => toggleSelection(competency.id, "competency")}
                          >
                            {competency.name}
                          </button>
                        ))
                      ) : (
                        <span className="empty-inline">No competencies yet</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button className="primary-button" type="submit">
                Log accomplishment
              </button>
            </form>
          </article>
        </div>

        <div className="panel-stack">
          <article className="panel">
            <div className="panel-heading">
              <h2>Current-year summary</h2>
              <p>Summaries are limited to the current calendar year and grouped by request.</p>
            </div>

            <div className="summary-toolbar">
              <label>
                Group by
                <select
                  value={summaryFilter}
                  onChange={(event) => {
                    const nextFilter = event.target.value as SummaryFilter;
                    setSummaryFilter(nextFilter);
                    setSummaryItemId("all");
                  }}
                >
                  <option value="all">Goals and competencies</option>
                  <option value="goal">Goals only</option>
                  <option value="competency">Competencies only</option>
                </select>
              </label>

              <label>
                Focus item
                <select
                  value={summaryItemId}
                  onChange={(event) => setSummaryItemId(event.target.value)}
                >
                  <option value="all">All items</option>
                  {(summaryFilter === "goal"
                    ? goals
                    : summaryFilter === "competency"
                      ? competencies
                      : framework
                  ).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="summary-list">
              {groupedSummary.length ? (
                groupedSummary.map((group) => (
                  <article key={group.item.id} className="summary-card">
                    <div className="summary-heading">
                      <p className="summary-kind">{group.item.kind}</p>
                      <h3>{group.item.name}</h3>
                      {group.item.description ? <p>{group.item.description}</p> : null}
                    </div>

                    <ul>
                      {group.accomplishments.map((item) => (
                        <li key={item.id}>
                          <strong>{item.text}</strong>
                          <span>
                            {formatFriendlyDate(item.date)} | occurrences: {item.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <h3>No summary items yet</h3>
                  <p>
                    Save the framework and log accomplishments to generate grouped current-year
                    summaries.
                  </p>
                </div>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h2>Accomplishment log</h2>
              <p>Aggregated entries preserve the underlying history for context.</p>
            </div>

            <div className="log-list">
              {accomplishments.length ? (
                accomplishments.map((item) => {
                  const linkedItems = framework.filter((frameworkItem) =>
                    item.links.includes(frameworkItem.id)
                  );

                  return (
                    <article key={item.id} className="log-card">
                      <div className="log-header">
                        <p>{formatFriendlyDate(item.date)}</p>
                        <span>{item.count > 1 ? `${item.count} related wins` : "single entry"}</span>
                      </div>
                      <h3>{item.text}</h3>
                      <p className="assistant-copy">{item.assistantNote}</p>
                      <div className="chip-row">
                        {linkedItems.length ? (
                          linkedItems.map((linkedItem) => (
                            <span key={linkedItem.id} className="chip static">
                              {linkedItem.kind}: {linkedItem.name}
                            </span>
                          ))
                        ) : (
                          <span className="empty-inline">Uncategorized</span>
                        )}
                      </div>
                      {item.history.length > 1 ? (
                        <details>
                          <summary>View underlying notes</summary>
                          <ul className="history-list">
                            {item.history.map((note, index) => (
                              <li key={`${item.id}-${index}`}>{note}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="empty-state">
                  <h3>No accomplishments recorded</h3>
                  <p>The assistant will acknowledge, categorize, and summarize entries here.</p>
                </div>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
