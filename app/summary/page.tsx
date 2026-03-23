"use client";

import { useMemo, useState } from "react";
import { formatFriendlyDate } from "../lib/store";
import { useAccomplishmentsStore } from "../lib/store-provider";
import type { SummaryFilter } from "../lib/types";

export default function SummaryPage() {
  const { competencies, currentYearAccomplishments, framework, goalObjectives, goals, loaded } =
    useAccomplishmentsStore();
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>("all");
  const [summaryItemId, setSummaryItemId] = useState("all");

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

  const totals = useMemo(() => {
    return {
      groups: groupedSummary.length,
      entries: currentYearAccomplishments.length,
      occurrences: currentYearAccomplishments.reduce((sum, item) => sum + item.count, 0)
    };
  }, [currentYearAccomplishments, groupedSummary.length]);

  const growthAreas = useMemo(() => {
    const goalCounts = goals.map((goal) => ({
      item: goal,
      count: currentYearAccomplishments.filter((entry) => entry.links.includes(goal.id)).length
    }));
    const competencyCounts = competencies.map((competency) => ({
      item: competency,
      count: currentYearAccomplishments.filter((entry) => entry.links.includes(competency.id)).length
    }));

    const uncoveredGoals = goalCounts.filter((goal) => goal.count === 0).map((goal) => goal.item);
    const uncoveredCompetencies = competencyCounts
      .filter((competency) => competency.count === 0)
      .map((competency) => competency.item);

    const totalUncovered = uncoveredGoals.length + uncoveredCompetencies.length;

    if (totalUncovered >= 10) {
      return {
        goals: uncoveredGoals,
        competencies: uncoveredCompetencies,
        mode: "uncovered" as const
      };
    }

    const rankedGoals = goalCounts
      .sort((a, b) => a.count - b.count || a.item.name.localeCompare(b.item.name))
      .slice(0, 10)
      .map((goal) => goal.item);
    const rankedCompetencies = competencyCounts
      .sort((a, b) => a.count - b.count || a.item.name.localeCompare(b.item.name))
      .slice(0, 10)
      .map((competency) => competency.item);

    return {
      goals: rankedGoals,
      competencies: rankedCompetencies,
      mode: "lowest" as const
    };
  }, [competencies, currentYearAccomplishments, goals]);

  const goalObjectiveMap = useMemo(
    () => new Map(goalObjectives.map((goal) => [goal.id, goal])),
    [goalObjectives]
  );

  if (!loaded) {
    return (
      <main className="page-shell">
        <section className="panel">
          <p>Loading summary...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy-block">
          <p className="eyebrow">Summary</p>
          <h1>Review current-year accomplishments by goal or competency.</h1>
          <p className="hero-copy">
            This page is focused on retrieval only, so it stays clean and review-ready when you need
            to scan progress or prepare for self-assessments.
          </p>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span>Summary groups</span>
            <strong>{totals.groups}</strong>
          </article>
          <article className="stat-card">
            <span>Current-year entries</span>
            <strong>{totals.entries}</strong>
          </article>
          <article className="stat-card">
            <span>Total occurrences</span>
            <strong>{totals.occurrences}</strong>
          </article>
        </div>
      </section>

      <section className="assistant-banner">
        <div>
          <p className="assistant-label">Summary scope</p>
          <p className="assistant-message">
            Limited to the current calendar year, from January 1 through today.
          </p>
        </div>
      </section>

      <section className="single-column">
        <article className="panel">
          <div className="panel-heading">
            <h2>Filters</h2>
            <p>Group the summary by all items, only goals, or only competencies.</p>
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
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Grouped summary</h2>
            <p>Accomplishments appear under each linked goal or competency.</p>
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
                <h3>No matching summary yet</h3>
                <p>
                  Add accomplishments and link them to goals or competencies to populate this view.
                </p>
              </div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Areas for growth</h2>
            <p>
              {growthAreas.mode === "uncovered"
                ? "These goals and competencies do not yet have linked accomplishments in the current calendar year."
                : "You have fewer than 10 completely uncovered areas, so this view shows the lowest-coverage goals and competencies instead."}
            </p>
          </div>

          <div className="growth-grid">
            <section className="growth-card">
              <p className="summary-kind">goals</p>
              <h3>Objectives needing evidence</h3>
              {growthAreas.goals.length ? (
                <ul className="growth-list">
                  {growthAreas.goals.map((goal) => (
                    <li key={goal.id}>
                      <strong>{goal.name}</strong>
                      {goalObjectiveMap.get(goal.id)?.keyResults.length ? (
                        <span>
                          {goalObjectiveMap
                            .get(goal.id)
                            ?.keyResults.map((keyResult) => keyResult.text)
                            .join(" | ")}
                        </span>
                      ) : goal.description ? (
                        <span>{goal.description}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-inline">Every goal has at least one linked accomplishment.</p>
              )}
            </section>

            <section className="growth-card">
              <p className="summary-kind">competencies</p>
              <h3>Skills needing evidence</h3>
              {growthAreas.competencies.length ? (
                <ul className="growth-list">
                  {growthAreas.competencies.map((competency) => (
                    <li key={competency.id}>
                      <strong>{competency.name}</strong>
                      {competency.categoryName ? <span>{competency.categoryName}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-inline">
                  Every competency has at least one linked accomplishment.
                </p>
              )}
            </section>
          </div>
        </article>
      </section>
    </main>
  );
}
