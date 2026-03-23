"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  classifyAccomplishment,
  findSuggestedMatch,
  formatAssistantNote,
  formatFriendlyDate,
  normalizeText
} from "./lib/store";
import { useAccomplishmentsStore } from "./lib/store-provider";
import type { LlmCategorizationResult } from "./lib/types";

export default function Home() {
  const {
    accomplishments,
    competencies,
    currentYearAccomplishments,
    framework,
    goals,
    loaded,
    setAccomplishments,
    today
  } = useAccomplishmentsStore();
  const [entryText, setEntryText] = useState("");
  const [entryDate, setEntryDate] = useState(today);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  const [goalQuery, setGoalQuery] = useState("");
  const [competencyQuery, setCompetencyQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [message, setMessage] = useState(
    "Acting as your accomplishments assistant. Record what you did, and I’ll keep the log organized against your goals and competencies."
  );

  const dashboardStats = useMemo(() => {
    const totalCount = accomplishments.reduce((sum, item) => sum + item.count, 0);
    const linkedCount = accomplishments.filter((item) => item.links.length > 0).length;

    return {
      entries: accomplishments.length,
      totalCount,
      goalsCovered: new Set(
        accomplishments.flatMap((item) => item.links.filter((id) => goals.some((goal) => goal.id === id)))
      ).size,
      linkedCount
    };
  }, [accomplishments, goals]);

  const filteredGoals = useMemo(() => {
    const query = goalQuery.trim().toLowerCase();

    if (!query) {
      return goals;
    }

    return goals.filter((goal) =>
      `${goal.name} ${goal.description}`.toLowerCase().includes(query)
    );
  }, [goalQuery, goals]);

  const filteredCompetencies = useMemo(() => {
    const query = competencyQuery.trim().toLowerCase();

    if (!query) {
      return competencies;
    }

    return competencies.filter((competency) =>
      `${competency.name} ${competency.description} ${competency.categoryName ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [competencies, competencyQuery]);

  function toggleSelection(id: string, type: "goal" | "competency") {
    if (type === "goal") {
      setSelectedGoals((current) =>
        current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
      );
      return;
    }

    setSelectedCompetencies((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  function handleDeleteEntry(id: string) {
    const entry = accomplishments.find((item) => item.id === id);

    if (!entry) {
      return;
    }

    const shouldDelete = window.confirm(
      `Delete this tracked entry?\n\n"${entry.text}"`
    );

    if (!shouldDelete) {
      return;
    }

    setAccomplishments((current) => current.filter((item) => item.id !== id));
    setMessage("Tracked entry deleted.");
  }

  async function fetchLlmCategorization(
    accomplishment: string
  ): Promise<LlmCategorizationResult | null> {
    const response = await fetch("/api/categorize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accomplishment,
        framework
      })
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as LlmCategorizationResult;
  }

  async function handleEntrySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = entryText.trim();

    if (!trimmed) {
      return;
    }

    setIsAnalyzing(true);

    try {
      const llmSuggested =
        framework.length && !selectedGoals.length && !selectedCompetencies.length
          ? await fetchLlmCategorization(trimmed)
          : null;
      const suggested = framework.length ? classifyAccomplishment(trimmed, framework) : null;
      const draftLinks = {
        goals: selectedGoals.length
          ? selectedGoals
          : llmSuggested?.suggestedGoalIds.length
            ? llmSuggested.suggestedGoalIds
            : suggested?.goals ?? [],
        competencies: selectedCompetencies.length
          ? selectedCompetencies
          : llmSuggested?.suggestedCompetencyIds.length
            ? llmSuggested.suggestedCompetencyIds
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
            const combinedLinks = Array.from(
              new Set([...item.links, ...draftLinks.goals, ...draftLinks.competencies])
            );

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
        const newEntry = {
          id: crypto.randomUUID(),
          createdAt: new Date(`${entryDate}T12:00:00`).toISOString(),
          date: entryDate,
          text: trimmed,
          normalized: normalizeText(trimmed),
          links,
          count: 1,
          history: [trimmed],
          assistantNote:
            llmSuggested?.assistantNote || formatAssistantNote(draftLinks, framework, 1, false)
        };

        setAccomplishments((current) => [newEntry, ...current]);
        setMessage(newEntry.assistantNote);
      }

      setEntryText("");
      setSelectedGoals([]);
      setSelectedCompetencies([]);
    } finally {
      setIsAnalyzing(false);
    }
  }

  if (!loaded) {
    return <main className="page-shell"><section className="panel"><p>Loading your assistant workspace...</p></section></main>;
  }

  return (
    <main className="page-shell">
      <section className="hero entry-hero">
        <div className="hero-copy-block">
          <p className="eyebrow">home</p>
          <h1>record what you accomplished today.</h1>
          <p className="hero-copy">
            This page is built for fast capture first. Add the win while it is still fresh, then
            let the assistant organize it against your goals and competencies.
          </p>
        </div>

        <div className="entry-hero-side">
          <div className="stats-grid compact-stats">
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
        </div>
      </section>

      <section className="entry-layout">
        <article className="panel entry-panel">
          <div className="panel-heading">
            <h2>Daily entry</h2>
            <p>Manual links take priority. If none are selected, the assistant suggests them.</p>
          </div>

          <div className="entry-panel-meta">
            <p className="assistant-date">Current log date: {formatFriendlyDate(entryDate)}</p>
            <p className="assistant-date">
              {isAnalyzing
                ? "Analyzing with OpenAI..."
                : "Manual links override assistant suggestions."}
            </p>
          </div>

          {!goals.length || !competencies.length ? (
            <div className="callout">
              <p>
                The assistant works best once your framework is defined.
                {!goals.length ? " Add goals." : ""}
                {!competencies.length ? " Add competencies." : ""}
              </p>
              <div className="inline-links">
                <Link href="/goals">Open goals</Link>
                <Link href="/competencies">Open competencies</Link>
              </div>
            </div>
          ) : null}

          <form className="entry-form spotlight-entry-form" onSubmit={handleEntrySubmit}>
            <label>
              Accomplishment
              <textarea
                value={entryText}
                onChange={(event) => setEntryText(event.target.value)}
                rows={7}
                placeholder="Example: Led a project risk review that unblocked launch planning."
              />
            </label>

            <div className="entry-support-grid">
              <label>
                Date
                <input
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                />
              </label>

              <div className="entry-help-card">
                <p className="assistant-label">Quick note</p>
                <p>
                  Keep it simple. A short sentence about the outcome is enough, and the assistant
                  can help with categorization.
                </p>
              </div>
            </div>

            <div className="selection-block">
              <p>Optional manual links</p>
              <div className="manual-link-panels">
                <details className="link-panel" open>
                  <summary>
                    <span>Goals</span>
                    <span>{selectedGoals.length} selected</span>
                  </summary>
                  {goals.length ? (
                    <div className="link-panel-body">
                      <input
                        className="link-search"
                        type="text"
                        value={goalQuery}
                        onChange={(event) => setGoalQuery(event.target.value)}
                        placeholder="Search goals"
                      />
                      <div className="chip-row">
                        {filteredGoals.length ? (
                          filteredGoals.map((goal) => (
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
                          <span className="empty-inline">No matching goals</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="empty-inline">No goals yet</span>
                  )}
                </details>

                <details className="link-panel">
                  <summary>
                    <span>Competencies</span>
                    <span>{selectedCompetencies.length} selected</span>
                  </summary>
                  {competencies.length ? (
                    <div className="link-panel-body">
                      <input
                        className="link-search"
                        type="text"
                        value={competencyQuery}
                        onChange={(event) => setCompetencyQuery(event.target.value)}
                        placeholder="Search competencies"
                      />
                      <div className="chip-row">
                        {filteredCompetencies.length ? (
                          filteredCompetencies.map((competency) => (
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
                          <span className="empty-inline">No matching competencies</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="empty-inline">No competencies yet</span>
                  )}
                </details>
              </div>
            </div>

            <button className="primary-button" type="submit" disabled={isAnalyzing}>
              {isAnalyzing ? "Analyzing..." : "Log accomplishment"}
            </button>
          </form>
        </article>

        <aside className="panel side-panel">
          <div className="panel-heading">
            <h2>Today at a glance</h2>
            <p>Helpful context while you capture, without taking over the page.</p>
          </div>

          <div className="mini-stat-list">
            <article className="mini-stat">
              <span>Current-year entries</span>
              <strong>{currentYearAccomplishments.length}</strong>
            </article>
            <article className="mini-stat">
              <span>Total logged wins</span>
              <strong>{dashboardStats.totalCount}</strong>
            </article>
            <article className="mini-stat">
              <span>Goals represented</span>
              <strong>{dashboardStats.goalsCovered}</strong>
            </article>
          </div>

          <div className="side-summary">
            <p className="assistant-label">Recent review-ready items</p>
            {currentYearAccomplishments.length ? (
              currentYearAccomplishments.slice(0, 3).map((item) => (
                <article key={item.id} className="summary-card">
                  <h3>{item.text}</h3>
                  <p>{formatFriendlyDate(item.date)}</p>
                  <span className="summary-meta">Occurrences: {item.count}</span>
                </article>
              ))
            ) : (
              <div className="empty-state compact-empty">
                <h3>No summary items yet</h3>
                <p>Once you start logging, your strongest recent items will show up here.</p>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="secondary-home-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>Accomplishment log</h2>
            <p>Aggregated entries preserve the underlying notes and their categorization links.</p>
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
                        <div className="log-header-actions">
                          <span>
                            {item.count > 1 ? `${item.count} related wins` : "single entry"}
                          </span>
                          <button
                            type="button"
                            className="delete-link"
                            onClick={() => handleDeleteEntry(item.id)}
                          >
                            Delete
                          </button>
                        </div>
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

        <article className="panel">
          <div className="panel-heading">
            <h2>Current-year summary</h2>
            <p>Entries from January 1 through today, ready for review conversations.</p>
          </div>

          <div className="summary-list compact">
            {currentYearAccomplishments.length ? (
              currentYearAccomplishments.map((item) => (
                <article key={item.id} className="summary-card">
                  <h3>{item.text}</h3>
                  <p>{formatFriendlyDate(item.date)}</p>
                  <span className="summary-meta">Occurrences: {item.count}</span>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <h3>No summary items yet</h3>
                <p>Log your first accomplishment to start building year-to-date evidence.</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
