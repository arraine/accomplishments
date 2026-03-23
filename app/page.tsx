"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  findSuggestedMatch,
  formatAssistantNote,
  formatFriendlyDate,
  normalizeText
} from "./lib/store";
import { useAccomplishmentsStore } from "./lib/store-provider";
import type { Accomplishment } from "./lib/types";

type DraftLinks = {
  goals: string[];
  competencies: string[];
};

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
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editDate, setEditDate] = useState(today);
  const [editGoals, setEditGoals] = useState<string[]>([]);
  const [editCompetencies, setEditCompetencies] = useState<string[]>([]);
  const [editGoalQuery, setEditGoalQuery] = useState("");
  const [editCompetencyQuery, setEditCompetencyQuery] = useState("");
  const [message, setMessage] = useState(
    "Record what you did and link it to the goals and competencies you want this evidence to support."
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

    return goals.filter((goal) => `${goal.name} ${goal.description}`.toLowerCase().includes(query));
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

  const filteredEditGoals = useMemo(() => {
    const query = editGoalQuery.trim().toLowerCase();

    if (!query) {
      return goals;
    }

    return goals.filter((goal) => `${goal.name} ${goal.description}`.toLowerCase().includes(query));
  }, [editGoalQuery, goals]);

  const filteredEditCompetencies = useMemo(() => {
    const query = editCompetencyQuery.trim().toLowerCase();

    if (!query) {
      return competencies;
    }

    return competencies.filter((competency) =>
      `${competency.name} ${competency.description} ${competency.categoryName ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [competencies, editCompetencyQuery]);

  const selectedGoalItems = useMemo(
    () => goals.filter((goal) => selectedGoals.includes(goal.id)),
    [goals, selectedGoals]
  );

  const selectedCompetencyItems = useMemo(
    () => competencies.filter((competency) => selectedCompetencies.includes(competency.id)),
    [competencies, selectedCompetencies]
  );

  const selectedEditGoalItems = useMemo(
    () => goals.filter((goal) => editGoals.includes(goal.id)),
    [editGoals, goals]
  );

  const selectedEditCompetencyItems = useMemo(
    () => competencies.filter((competency) => editCompetencies.includes(competency.id)),
    [competencies, editCompetencies]
  );

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

  function toggleEditSelection(id: string, type: "goal" | "competency") {
    if (type === "goal") {
      setEditGoals((current) =>
        current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
      );
      return;
    }

    setEditCompetencies((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  function clearSelections() {
    setSelectedGoals([]);
    setSelectedCompetencies([]);
  }

  function resetEntryComposer() {
    setEntryText("");
    setGoalQuery("");
    setCompetencyQuery("");
    clearSelections();
  }

  function resetEditComposer() {
    setEditingEntryId(null);
    setEditText("");
    setEditDate(today);
    setEditGoals([]);
    setEditCompetencies([]);
    setEditGoalQuery("");
    setEditCompetencyQuery("");
  }

  function regroupEntries(entries: Accomplishment[]) {
    const ordered = [...entries].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
    const nextEntries: Accomplishment[] = [];

    for (const entry of ordered) {
      const links = {
        goals: entry.links.filter((id) => goals.some((goal) => goal.id === id)),
        competencies: entry.links.filter((id) =>
          competencies.some((competency) => competency.id === id)
        )
      };
      const suggestedMatch = findSuggestedMatch(entry.text, nextEntries, entry.links);

      if (!suggestedMatch) {
        nextEntries.push({
          ...entry,
          assistantNote: formatAssistantNote(links, framework, entry.count, entry.count > 1)
        });
        continue;
      }

      const targetIndex = nextEntries.findIndex((item) => item.id === suggestedMatch.accomplishmentId);

      if (targetIndex === -1) {
        nextEntries.push(entry);
        continue;
      }

      const target = nextEntries[targetIndex];
      const combinedLinks = Array.from(new Set([...target.links, ...entry.links]));
      const combinedCount = target.count + entry.count;
      const combinedDate =
        new Date(`${entry.date}T12:00:00`).getTime() > new Date(`${target.date}T12:00:00`).getTime()
          ? entry.date
          : target.date;
      const combinedCreatedAt =
        new Date(entry.createdAt).getTime() > new Date(target.createdAt).getTime()
          ? entry.createdAt
          : target.createdAt;

      nextEntries[targetIndex] = {
        ...target,
        date: combinedDate,
        createdAt: combinedCreatedAt,
        links: combinedLinks,
        count: combinedCount,
        history: [...target.history, ...entry.history],
        assistantNote: formatAssistantNote(
          {
            goals: combinedLinks.filter((id) => goals.some((goal) => goal.id === id)),
            competencies: combinedLinks.filter((id) =>
              competencies.some((competency) => competency.id === id)
            )
          },
          framework,
          combinedCount,
          true
        )
      };
    }

    return nextEntries;
  }

  function handleDeleteEntry(id: string) {
    const entry = accomplishments.find((item) => item.id === id);

    if (!entry) {
      return;
    }

    const shouldDelete = window.confirm(`Delete this tracked entry?\n\n"${entry.text}"`);

    if (!shouldDelete) {
      return;
    }

    setAccomplishments((current) => current.filter((item) => item.id !== id));
    setMessage("Tracked entry deleted.");
  }

  function handleStartEdit(entry: Accomplishment) {
    setEditingEntryId(entry.id);
    setEditText(entry.text);
    setEditDate(entry.date);
    setEditGoals(entry.links.filter((id) => goals.some((goal) => goal.id === id)));
    setEditCompetencies(
      entry.links.filter((id) => competencies.some((competency) => competency.id === id))
    );
    setEditGoalQuery("");
    setEditCompetencyQuery("");
    setMessage("Editing entry. Update the text and links, then save changes.");
  }

  function saveEntry(trimmed: string, effectiveDate: string, draftLinks: DraftLinks) {
    const suggestedMatch = findSuggestedMatch(trimmed, accomplishments, [
      ...draftLinks.goals,
      ...draftLinks.competencies
    ]);

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
            date: effectiveDate,
            createdAt: new Date(`${effectiveDate}T12:00:00`).toISOString(),
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
      setMessage(`Saved and aggregated with a recent entry. ${suggestedMatch.reason}`);
      return;
    }

    const links = [...draftLinks.goals, ...draftLinks.competencies];
    const newEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date(`${effectiveDate}T12:00:00`).toISOString(),
      date: effectiveDate,
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

  function handleEntrySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = entryText.trim();

    if (!trimmed) {
      return;
    }

    saveEntry(trimmed, entryDate, {
      goals: selectedGoals,
      competencies: selectedCompetencies
    });
    resetEntryComposer();
  }

  function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingEntryId) {
      return;
    }

    const trimmed = editText.trim();

    if (!trimmed) {
      return;
    }

    setAccomplishments((current) => {
      const updatedEntries = current.map((item) => {
        if (item.id !== editingEntryId) {
          return item;
        }

        const nextLinks = [...editGoals, ...editCompetencies];

        return {
          ...item,
          date: editDate,
          createdAt: new Date(`${editDate}T12:00:00`).toISOString(),
          text: trimmed,
          normalized: normalizeText(trimmed),
          links: nextLinks,
          assistantNote: formatAssistantNote(
            {
              goals: editGoals,
              competencies: editCompetencies
            },
            framework,
            item.count,
            item.count > 1
          )
        };
      });

      return regroupEntries(updatedEntries);
    });

    resetEditComposer();
    setMessage("Entry updated. Aggregation and links have been refreshed.");
  }

  if (!loaded) {
    return (
      <main className="page-shell">
        <section className="panel">
          <p>Loading your workspace...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="hero entry-hero">
        <div className="hero-copy-block">
          <p className="eyebrow">home</p>
          <h1>record what you accomplished today.</h1>
          <p className="hero-copy">
            This page is built for quick manual entry. Capture the win, choose the goals and
            competencies it supports, and keep your evidence organized as you go.
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
            <p>Write the accomplishment once, then manually attach the evidence where it belongs.</p>
          </div>

          <div className="entry-panel-meta">
            <p className="assistant-date">Current log date: {formatFriendlyDate(entryDate)}</p>
            <p className="assistant-date">{message}</p>
          </div>

          {!goals.length || !competencies.length ? (
            <div className="callout">
              <p>
                Manual linking works best once your framework is defined.
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
                placeholder="Example: led a project risk review that unblocked launch planning."
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
                <p className="assistant-label">How to use this page</p>
                <p>
                  Keep the accomplishment short, then add the exact goals and competencies you want
                  it to count toward.
                </p>
              </div>
            </div>

            <div className="manual-selection-summary">
              <div className="selection-summary-header">
                <div>
                  <p className="assistant-label">Selected links</p>
                  <p className="selection-summary-copy">
                    {selectedGoals.length || selectedCompetencies.length
                      ? `${selectedGoals.length} goal${selectedGoals.length === 1 ? "" : "s"} and ${selectedCompetencies.length} competency${selectedCompetencies.length === 1 ? "" : "ies"} selected`
                      : "No links selected yet. You can still save now and link it later."}
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearSelections}
                  disabled={!selectedGoals.length && !selectedCompetencies.length}
                >
                  Clear links
                </button>
              </div>

              {selectedGoals.length || selectedCompetencies.length ? (
                <div className="selected-link-groups">
                  <div className="chip-row">
                    {selectedGoalItems.map((goal) => (
                      <span key={goal.id} className="chip static">
                        goal: {goal.name}
                      </span>
                    ))}
                    {selectedCompetencyItems.map((competency) => (
                      <span key={competency.id} className="chip static">
                        competency: {competency.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="selection-block">
              <p>Manual links</p>
              <div className="manual-link-grid">
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

                <details className="link-panel" open>
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

            <div className="entry-form-actions">
              <button className="primary-button" type="submit">
                Save entry
              </button>
              <p className="entry-actions-copy">
                Entries with matching wording and links will still aggregate into one stronger log
                item.
              </p>
            </div>
          </form>
        </article>

        <aside className="panel side-panel">
          <div className="panel-heading">
            <h2>Manual workflow</h2>
            <p>Everything on this page is optimized for fast capture and intentional linking.</p>
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
            <p className="assistant-label">Quick checklist</p>
            <div className="summary-card">
              <h3>Capture the win</h3>
              <p>Write one short accomplishment while the details are still fresh.</p>
            </div>
            <div className="summary-card">
              <h3>Choose the evidence</h3>
              <p>Pick the goals and competencies you want this entry to support.</p>
            </div>
            <div className="summary-card">
              <h3>Build review-ready proof</h3>
              <p>Repeated wins automatically roll up when they line up with recent entries.</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="secondary-home-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>Accomplishment log</h2>
            <p>Aggregated entries preserve the underlying notes and the links you chose manually.</p>
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
                        <span>{item.count > 1 ? `${item.count} related wins` : "single entry"}</span>
                        <button
                          type="button"
                          className="delete-link"
                          onClick={() => handleStartEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="delete-link"
                          onClick={() => handleDeleteEntry(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {editingEntryId === item.id ? (
                      <form className="edit-entry-form" onSubmit={handleEditSubmit}>
                        <label>
                          Accomplishment
                          <textarea
                            value={editText}
                            onChange={(event) => setEditText(event.target.value)}
                            rows={5}
                          />
                        </label>
                        <label>
                          Date
                          <input
                            type="date"
                            value={editDate}
                            onChange={(event) => setEditDate(event.target.value)}
                          />
                        </label>

                        <div className="manual-selection-summary compact-selection-summary">
                          <div className="selection-summary-header">
                            <div>
                              <p className="assistant-label">Selected links</p>
                              <p className="selection-summary-copy">
                                {editGoals.length || editCompetencies.length
                                  ? `${editGoals.length} goal${editGoals.length === 1 ? "" : "s"} and ${editCompetencies.length} competency${editCompetencies.length === 1 ? "" : "ies"} selected`
                                  : "No links selected yet."}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                setEditGoals([]);
                                setEditCompetencies([]);
                              }}
                              disabled={!editGoals.length && !editCompetencies.length}
                            >
                              Clear links
                            </button>
                          </div>

                          {editGoals.length || editCompetencies.length ? (
                            <div className="chip-row">
                              {selectedEditGoalItems.map((goal) => (
                                <span key={goal.id} className="chip static">
                                  goal: {goal.name}
                                </span>
                              ))}
                              {selectedEditCompetencyItems.map((competency) => (
                                <span key={competency.id} className="chip static">
                                  competency: {competency.name}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="selection-block">
                          <p>Update links</p>
                          <div className="manual-link-grid">
                            <details className="link-panel" open>
                              <summary>
                                <span>Goals</span>
                                <span>{editGoals.length} selected</span>
                              </summary>
                              <div className="link-panel-body">
                                <input
                                  className="link-search"
                                  type="text"
                                  value={editGoalQuery}
                                  onChange={(event) => setEditGoalQuery(event.target.value)}
                                  placeholder="Search goals"
                                />
                                <div className="chip-row">
                                  {filteredEditGoals.length ? (
                                    filteredEditGoals.map((goal) => (
                                      <button
                                        key={goal.id}
                                        type="button"
                                        className={editGoals.includes(goal.id) ? "chip active" : "chip"}
                                        onClick={() => toggleEditSelection(goal.id, "goal")}
                                      >
                                        {goal.name}
                                      </button>
                                    ))
                                  ) : (
                                    <span className="empty-inline">No matching goals</span>
                                  )}
                                </div>
                              </div>
                            </details>

                            <details className="link-panel" open>
                              <summary>
                                <span>Competencies</span>
                                <span>{editCompetencies.length} selected</span>
                              </summary>
                              <div className="link-panel-body">
                                <input
                                  className="link-search"
                                  type="text"
                                  value={editCompetencyQuery}
                                  onChange={(event) => setEditCompetencyQuery(event.target.value)}
                                  placeholder="Search competencies"
                                />
                                <div className="chip-row">
                                  {filteredEditCompetencies.length ? (
                                    filteredEditCompetencies.map((competency) => (
                                      <button
                                        key={competency.id}
                                        type="button"
                                        className={
                                          editCompetencies.includes(competency.id) ? "chip active" : "chip"
                                        }
                                        onClick={() => toggleEditSelection(competency.id, "competency")}
                                      >
                                        {competency.name}
                                      </button>
                                    ))
                                  ) : (
                                    <span className="empty-inline">No matching competencies</span>
                                  )}
                                </div>
                              </div>
                            </details>
                          </div>
                        </div>

                        <div className="entry-form-actions">
                          <button className="primary-button" type="submit">
                            Save changes
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={resetEditComposer}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
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
                            <span className="empty-inline">No links selected</span>
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
                      </>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="empty-state">
                <h3>No accomplishments recorded</h3>
                <p>Start logging wins here and manually connect them to your framework.</p>
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
