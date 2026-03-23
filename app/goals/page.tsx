"use client";

import { useEffect, useState } from "react";
import { useAccomplishmentsStore } from "../lib/store-provider";
import type { GoalObjective } from "../lib/types";

function createGoalObjective(): GoalObjective {
  return {
    id: crypto.randomUUID(),
    objective: "",
    description: "",
    keyResults: [{ id: crypto.randomUUID(), text: "" }]
  };
}

export default function GoalsPage() {
  const {
    accomplishments,
    currentYearAccomplishments,
    goalObjectives,
    goals,
    loaded,
    saveGoals
  } = useAccomplishmentsStore();
  const [objectives, setObjectives] = useState<GoalObjective[]>(goalObjectives);
  const [showSavedNotice, setShowSavedNotice] = useState(false);
  const [message, setMessage] = useState(
    "Define each goal as an objective, then add the key results that indicate progress against it."
  );

  useEffect(() => {
    setObjectives(goalObjectives);
  }, [goalObjectives]);

  useEffect(() => {
    if (!showSavedNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowSavedNotice(false);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showSavedNotice]);

  if (!loaded) {
    return (
      <main className="page-shell">
        <section className="panel">
          <p>Loading goals...</p>
        </section>
      </main>
    );
  }

  const linkedThisYear = currentYearAccomplishments.filter((item) =>
    item.links.some((link) => goals.some((goal) => goal.id === link))
  ).length;
  const linkedOverall = accomplishments.filter((item) =>
    item.links.some((link) => goals.some((goal) => goal.id === link))
  ).length;

  function updateObjective(objectiveId: string, updates: Partial<GoalObjective>) {
    setObjectives((current) =>
      current.map((objective) =>
        objective.id === objectiveId ? { ...objective, ...updates } : objective
      )
    );
  }

  function removeObjective(objectiveId: string) {
    setObjectives((current) => current.filter((objective) => objective.id !== objectiveId));
  }

  function addKeyResult(objectiveId: string) {
    setObjectives((current) =>
      current.map((objective) =>
        objective.id === objectiveId
          ? {
              ...objective,
              keyResults: [...objective.keyResults, { id: crypto.randomUUID(), text: "" }]
            }
          : objective
      )
    );
  }

  function updateKeyResult(objectiveId: string, keyResultId: string, text: string) {
    setObjectives((current) =>
      current.map((objective) =>
        objective.id === objectiveId
          ? {
              ...objective,
              keyResults: objective.keyResults.map((keyResult) =>
                keyResult.id === keyResultId ? { ...keyResult, text } : keyResult
              )
            }
          : objective
      )
    );
  }

  function removeKeyResult(objectiveId: string, keyResultId: string) {
    setObjectives((current) =>
      current.map((objective) =>
        objective.id === objectiveId
          ? {
              ...objective,
              keyResults: objective.keyResults.filter((keyResult) => keyResult.id !== keyResultId)
            }
          : objective
      )
    );
  }

  function handleSave() {
    const cleanedObjectives = objectives
      .map((objective) => ({
        ...objective,
        objective: objective.objective.trim(),
        description: objective.description.trim(),
        keyResults: objective.keyResults
          .map((keyResult) => ({
            ...keyResult,
            text: keyResult.text.trim()
          }))
          .filter((keyResult) => keyResult.text)
      }))
      .filter((objective) => objective.objective);

    saveGoals({ goalObjectives: cleanedObjectives });
    setShowSavedNotice(true);
    setMessage(
      "Goals saved as OKRs. The assistant will now categorize accomplishments against your objectives."
    );
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy-block">
          <p className="eyebrow">Goals</p>
          <h1>Organize goals as objectives with key results.</h1>
          <p className="hero-copy">
            Each objective captures the broader outcome you want, while key results help describe
            how progress will show up over time.
          </p>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span>Objectives</span>
            <strong>{objectives.length}</strong>
          </article>
          <article className="stat-card">
            <span>Tracked goal items</span>
            <strong>{goals.length}</strong>
          </article>
          <article className="stat-card">
            <span>Entries linked overall</span>
            <strong>{linkedOverall}</strong>
          </article>
          <article className="stat-card">
            <span>Entries linked this year</span>
            <strong>{linkedThisYear}</strong>
          </article>
        </div>
      </section>

      <section className="assistant-banner">
        <div>
          <p className="assistant-label">Assistant status</p>
          <p className="assistant-message">{message}</p>
        </div>
      </section>

      <section className="single-column">
        <article className="panel">
          <div className="panel-heading">
            <h2>Objective editor</h2>
            <p>Create one objective at a time, then add any key results that support it.</p>
          </div>

          <div className="category-stack">
            {objectives.map((objective, objectiveIndex) => (
              <section key={objective.id} className="category-card">
                <div className="category-head">
                  <h3>Objective {objectiveIndex + 1}</h3>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => removeObjective(objective.id)}
                  >
                    Remove objective
                  </button>
                </div>

                <label>
                  Objective
                  <input
                    type="text"
                    value={objective.objective}
                    onChange={(event) =>
                      updateObjective(objective.id, { objective: event.target.value })
                    }
                    placeholder="Example: Improve cross-functional delivery predictability"
                  />
                </label>

                <label>
                  Context
                  <textarea
                    rows={3}
                    value={objective.description}
                    onChange={(event) =>
                      updateObjective(objective.id, { description: event.target.value })
                    }
                    placeholder="Optional context for what this objective is trying to achieve."
                  />
                </label>

                <div className="competency-stack">
                  {objective.keyResults.map((keyResult, keyResultIndex) => (
                    <article key={keyResult.id} className="competency-card">
                      <div className="category-head">
                        <h4>Key result {keyResultIndex + 1}</h4>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => removeKeyResult(objective.id, keyResult.id)}
                        >
                          Remove key result
                        </button>
                      </div>

                      <label>
                        Key result
                        <input
                          type="text"
                          value={keyResult.text}
                          onChange={(event) =>
                            updateKeyResult(objective.id, keyResult.id, event.target.value)
                          }
                          placeholder="Example: Publish weekly launch-risk updates with clear owners"
                        />
                      </label>
                    </article>
                  ))}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => addKeyResult(objective.id)}
                >
                  Add key result
                </button>
              </section>
            ))}
          </div>

          <div className="editor-actions">
            {showSavedNotice ? (
              <div className="save-notice" role="status" aria-live="polite">
                Goals saved
              </div>
            ) : null}
            <button
              type="button"
              className="secondary-button"
              onClick={() => setObjectives((current) => [...current, createGoalObjective()])}
            >
              Add objective
            </button>
            <button className="primary-button" type="button" onClick={handleSave}>
              Save goals
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}
