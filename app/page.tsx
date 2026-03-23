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
import type { LlmCategorizationResult, PriorCategorizationExample } from "./lib/types";

type PendingClarification = {
  accomplishment: string;
  date: string;
  question: string;
  suggestedGoalIds: string[];
  suggestedCompetencyIds: string[];
};

type DraftLinks = {
  goals: string[];
  competencies: string[];
};

type CategorizationDebugState = {
  source: "manual" | "openai" | "fallback" | "clarification" | "top-suggestions";
  accomplishment: string;
  frameworkCount: number;
  openAiStatus: "not-used" | "success" | "error";
  openAiError: string;
  clarificationAnswer: string;
  resultType: "direct" | "clarification" | "none";
  assistantNote: string;
  clarificationQuestion: string;
  llmGoalIds: string[];
  llmCompetencyIds: string[];
  fallbackGoalIds: string[];
  fallbackCompetencyIds: string[];
  finalGoalIds: string[];
  finalCompetencyIds: string[];
};

type CategorizationResponse = {
  data: LlmCategorizationResult | null;
  error: string;
};

export default function Home() {
  const {
    accomplishments,
    competencies,
    competencyCategories,
    currentYearAccomplishments,
    framework,
    goalObjectives,
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
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [pendingClarification, setPendingClarification] = useState<PendingClarification | null>(null);
  const [categorizationDebug, setCategorizationDebug] = useState<CategorizationDebugState | null>(null);
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

  const priorCategorizationExamples = useMemo<PriorCategorizationExample[]>(() => {
    return accomplishments
      .filter((item) => item.links.length > 0)
      .slice(0, 12)
      .map((item) => {
        const goalMatches = goals.filter((goal) => item.links.includes(goal.id));
        const competencyMatches = competencies.filter((competency) => item.links.includes(competency.id));

        return {
          text: item.text,
          goalIds: goalMatches.map((goal) => goal.id),
          goalNames: goalMatches.map((goal) => goal.name),
          competencyIds: competencyMatches.map((competency) => competency.id),
          competencyNames: competencyMatches.map((competency) => competency.name)
        };
      });
  }, [accomplishments, competencies, goals]);

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
    accomplishment: string,
    clarification?: string
  ): Promise<CategorizationResponse> {
    const response = await fetch("/api/categorize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accomplishment,
        framework,
        goalObjectives,
        competencyCategories,
        priorExamples: priorCategorizationExamples,
        clarificationAnswer: clarification ?? ""
      })
    });

    if (!response.ok) {
      let errorMessage = "Categorization request failed.";

      try {
        const payload = (await response.json()) as { error?: string };
        errorMessage = payload.error || errorMessage;
      } catch {}

      return {
        data: null,
        error: errorMessage
      };
    }

    return {
      data: (await response.json()) as LlmCategorizationResult,
      error: ""
    };
  }

  function resolveLinkNames(ids: string[], type: "goal" | "competency") {
    const items = type === "goal" ? goals : competencies;

    return ids
      .map((id) => items.find((item) => item.id === id)?.name)
      .filter((name): name is string => Boolean(name));
  }

  function resetEntryComposer() {
    setEntryText("");
    setSelectedGoals([]);
    setSelectedCompetencies([]);
    setGoalQuery("");
    setCompetencyQuery("");
    setPendingClarification(null);
    setClarificationAnswer("");
  }

  function updateCategorizationDebug(nextDebug: CategorizationDebugState) {
    setCategorizationDebug(nextDebug);
  }

  function saveEntry(
    trimmed: string,
    effectiveDate: string,
    draftLinks: DraftLinks,
    llmSuggested: LlmCategorizationResult | null
  ) {
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
      setMessage(
        `Logged and aggregated with a recent entry. ${suggestedMatch.reason} Occurrence count increased.`
      );
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
      assistantNote:
        llmSuggested?.assistantNote || formatAssistantNote(draftLinks, framework, 1, false)
    };

    setAccomplishments((current) => [newEntry, ...current]);
    setMessage(newEntry.assistantNote);
  }

  async function handleEntrySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = entryText.trim();

    if (!trimmed) {
      return;
    }

    setIsAnalyzing(true);

    try {
      const llmResponse =
        framework.length && !selectedGoals.length && !selectedCompetencies.length
          ? await fetchLlmCategorization(trimmed)
          : { data: null, error: "" };
      const llmSuggested = llmResponse.data;
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

      updateCategorizationDebug({
        source: selectedGoals.length || selectedCompetencies.length
          ? "manual"
          : llmSuggested?.suggestedGoalIds.length || llmSuggested?.suggestedCompetencyIds.length
            ? "openai"
            : suggested?.goals.length || suggested?.competencies.length
              ? "fallback"
              : "fallback",
        accomplishment: trimmed,
        frameworkCount: framework.length,
        openAiStatus: llmSuggested ? "success" : llmResponse.error ? "error" : "not-used",
        openAiError: llmResponse.error,
        clarificationAnswer: "",
        resultType: llmSuggested?.resultType ?? "none",
        assistantNote: llmSuggested?.assistantNote ?? "",
        clarificationQuestion: llmSuggested?.clarificationQuestion ?? "",
        llmGoalIds: llmSuggested?.suggestedGoalIds ?? [],
        llmCompetencyIds: llmSuggested?.suggestedCompetencyIds ?? [],
        fallbackGoalIds: suggested?.goals ?? [],
        fallbackCompetencyIds: suggested?.competencies ?? [],
        finalGoalIds: draftLinks.goals,
        finalCompetencyIds: draftLinks.competencies
      });

      if (llmSuggested?.resultType === "clarification" && llmSuggested.clarificationQuestion) {
        setPendingClarification({
          accomplishment: trimmed,
          date: entryDate,
          question: llmSuggested.clarificationQuestion,
          suggestedGoalIds: draftLinks.goals,
          suggestedCompetencyIds: draftLinks.competencies
        });
        setMessage("One follow-up will help the assistant categorize this more accurately.");
        return;
      }

      saveEntry(trimmed, entryDate, draftLinks, llmSuggested);
      resetEntryComposer();
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleClarificationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pendingClarification) {
      return;
    }

    setIsAnalyzing(true);

    try {
      const llmResponse = await fetchLlmCategorization(
        pendingClarification.accomplishment,
        clarificationAnswer
      );
      const llmSuggested = llmResponse.data;
      const fallbackSuggested = framework.length
        ? classifyAccomplishment(pendingClarification.accomplishment, framework)
        : null;
      const draftLinks = {
        goals:
          llmSuggested?.suggestedGoalIds.length
            ? llmSuggested.suggestedGoalIds
            : pendingClarification.suggestedGoalIds.length
              ? pendingClarification.suggestedGoalIds
              : fallbackSuggested?.goals ?? [],
        competencies:
          llmSuggested?.suggestedCompetencyIds.length
            ? llmSuggested.suggestedCompetencyIds
            : pendingClarification.suggestedCompetencyIds.length
              ? pendingClarification.suggestedCompetencyIds
              : fallbackSuggested?.competencies ?? []
      };

      updateCategorizationDebug({
        source: "clarification",
        accomplishment: pendingClarification.accomplishment,
        frameworkCount: framework.length,
        openAiStatus: llmSuggested ? "success" : llmResponse.error ? "error" : "not-used",
        openAiError: llmResponse.error,
        clarificationAnswer,
        resultType: llmSuggested?.resultType ?? "none",
        assistantNote: llmSuggested?.assistantNote ?? "",
        clarificationQuestion: llmSuggested?.clarificationQuestion ?? "",
        llmGoalIds: llmSuggested?.suggestedGoalIds ?? [],
        llmCompetencyIds: llmSuggested?.suggestedCompetencyIds ?? [],
        fallbackGoalIds: fallbackSuggested?.goals ?? [],
        fallbackCompetencyIds: fallbackSuggested?.competencies ?? [],
        finalGoalIds: draftLinks.goals,
        finalCompetencyIds: draftLinks.competencies
      });

      if (llmSuggested?.resultType === "clarification" && llmSuggested.clarificationQuestion) {
        setPendingClarification({
          accomplishment: pendingClarification.accomplishment,
          date: pendingClarification.date,
          question: llmSuggested.clarificationQuestion,
          suggestedGoalIds: draftLinks.goals,
          suggestedCompetencyIds: draftLinks.competencies
        });
        setMessage("The assistant still needs one sharper detail, but its best suggestions are ready if you want to save now.");
        return;
      }

      saveEntry(
        pendingClarification.accomplishment,
        pendingClarification.date,
        draftLinks,
        llmSuggested
      );
      resetEntryComposer();
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

            {pendingClarification ? (
              <div className="clarification-card">
                <p className="assistant-label">One quick question</p>
                <p>{pendingClarification.question}</p>
                <div className="chip-row">
                  {pendingClarification.suggestedGoalIds.map((id) => {
                    const goal = goals.find((item) => item.id === id);
                    return goal ? (
                      <span key={id} className="chip static">
                        goal: {goal.name}
                      </span>
                    ) : null;
                  })}
                  {pendingClarification.suggestedCompetencyIds.map((id) => {
                    const competency = competencies.find((item) => item.id === id);
                    return competency ? (
                      <span key={id} className="chip static">
                        competency: {competency.name}
                      </span>
                    ) : null;
                  })}
                </div>
                <form className="clarification-form" onSubmit={handleClarificationSubmit}>
                  <label>
                    Your answer
                    <input
                      type="text"
                      value={clarificationAnswer}
                      onChange={(event) => setClarificationAnswer(event.target.value)}
                      placeholder="Add one short clarifying detail"
                    />
                  </label>
                  <div className="clarification-actions">
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={isAnalyzing || !clarificationAnswer.trim()}
                    >
                      {isAnalyzing ? "Analyzing..." : "Continue"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        saveEntry(
                          pendingClarification.accomplishment,
                          pendingClarification.date,
                          {
                            goals: pendingClarification.suggestedGoalIds,
                            competencies: pendingClarification.suggestedCompetencyIds
                          },
                          {
                            resultType: "direct",
                            assistantNote:
                              "Recorded using the assistant's best current suggestions.",
                            suggestedGoalIds: pendingClarification.suggestedGoalIds,
                            suggestedCompetencyIds: pendingClarification.suggestedCompetencyIds,
                            clarificationQuestion: ""
                          }
                        );
                        updateCategorizationDebug({
                          source: "top-suggestions",
                          accomplishment: pendingClarification.accomplishment,
                          frameworkCount: framework.length,
                          openAiStatus: "success",
                          openAiError: "",
                          clarificationAnswer,
                          resultType: "direct",
                          assistantNote: "Recorded using the assistant's best current suggestions.",
                          clarificationQuestion: "",
                          llmGoalIds: pendingClarification.suggestedGoalIds,
                          llmCompetencyIds: pendingClarification.suggestedCompetencyIds,
                          fallbackGoalIds: [],
                          fallbackCompetencyIds: [],
                          finalGoalIds: pendingClarification.suggestedGoalIds,
                          finalCompetencyIds: pendingClarification.suggestedCompetencyIds
                        });
                        resetEntryComposer();
                      }}
                    >
                      Use top suggestions
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setPendingClarification(null);
                        setClarificationAnswer("");
                        setMessage("Clarification dismissed. You can adjust manual links or log a different wording.");
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            <button className="primary-button" type="submit" disabled={isAnalyzing}>
              {isAnalyzing ? "Analyzing..." : "Log accomplishment"}
            </button>
          </form>

          {categorizationDebug ? (
            <details className="debug-panel">
              <summary>View categorization debug</summary>
              <div className="debug-grid">
                <div className="debug-row">
                  <span>Source</span>
                  <strong>{categorizationDebug.source}</strong>
                </div>
                <div className="debug-row">
                  <span>Framework items</span>
                  <strong>{categorizationDebug.frameworkCount}</strong>
                </div>
                <div className="debug-row">
                  <span>OpenAI status</span>
                  <strong>{categorizationDebug.openAiStatus}</strong>
                </div>
                <div className="debug-block">
                  <span>Entry</span>
                  <p>{categorizationDebug.accomplishment}</p>
                </div>
                {categorizationDebug.openAiError ? (
                  <div className="debug-block">
                    <span>OpenAI error</span>
                    <p>{categorizationDebug.openAiError}</p>
                  </div>
                ) : null}
                {categorizationDebug.assistantNote ? (
                  <div className="debug-block">
                    <span>Assistant note</span>
                    <p>{categorizationDebug.assistantNote}</p>
                  </div>
                ) : null}
                {categorizationDebug.clarificationQuestion ? (
                  <div className="debug-block">
                    <span>Clarification question</span>
                    <p>{categorizationDebug.clarificationQuestion}</p>
                  </div>
                ) : null}
                {categorizationDebug.clarificationAnswer ? (
                  <div className="debug-block">
                    <span>Clarification answer</span>
                    <p>{categorizationDebug.clarificationAnswer}</p>
                  </div>
                ) : null}
                <div className="debug-block">
                  <span>OpenAI suggested goals</span>
                  <p>
                    {resolveLinkNames(categorizationDebug.llmGoalIds, "goal").join(", ") || "None"}
                  </p>
                </div>
                <div className="debug-block">
                  <span>OpenAI suggested competencies</span>
                  <p>
                    {resolveLinkNames(categorizationDebug.llmCompetencyIds, "competency").join(", ") || "None"}
                  </p>
                </div>
                <div className="debug-block">
                  <span>Fallback goals</span>
                  <p>
                    {resolveLinkNames(categorizationDebug.fallbackGoalIds, "goal").join(", ") || "None"}
                  </p>
                </div>
                <div className="debug-block">
                  <span>Fallback competencies</span>
                  <p>
                    {resolveLinkNames(categorizationDebug.fallbackCompetencyIds, "competency").join(", ") || "None"}
                  </p>
                </div>
                <div className="debug-block">
                  <span>Final goals saved</span>
                  <p>
                    {resolveLinkNames(categorizationDebug.finalGoalIds, "goal").join(", ") || "None"}
                  </p>
                </div>
                <div className="debug-block">
                  <span>Final competencies saved</span>
                  <p>
                    {resolveLinkNames(categorizationDebug.finalCompetencyIds, "competency").join(", ") || "None"}
                  </p>
                </div>
              </div>
            </details>
          ) : null}
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
