"use client";

import { useEffect, useState } from "react";
import { useAccomplishmentsStore } from "../lib/store-provider";
import type { CompetencyCategory, CompetencyLevel } from "../lib/types";

function createCategory(): CompetencyCategory {
  return {
    id: crypto.randomUUID(),
    name: "",
    competencies: [
      {
        id: crypto.randomUUID(),
        name: "",
        description: ""
      }
    ]
  };
}

export default function CompetenciesPage() {
  const {
    accomplishments,
    competencies,
    competencyCategories,
    competencyLevel,
    currentYearAccomplishments,
    loaded,
    saveCompetencies
  } = useAccomplishmentsStore();
  const [level, setLevel] = useState<CompetencyLevel>(competencyLevel);
  const [categories, setCategories] = useState<CompetencyCategory[]>(competencyCategories);
  const [message, setMessage] = useState(
    "Set your level, define competency categories, and list the competencies that belong in each category."
  );

  useEffect(() => {
    setLevel(competencyLevel);
    setCategories(competencyCategories);
  }, [competencyCategories, competencyLevel]);

  if (!loaded) {
    return (
      <main className="page-shell">
        <section className="panel">
          <p>Loading competencies...</p>
        </section>
      </main>
    );
  }

  const linkedThisYear = currentYearAccomplishments.filter((item) =>
    item.links.some((link) => competencies.some((competency) => competency.id === link))
  ).length;
  const linkedOverall = accomplishments.filter((item) =>
    item.links.some((link) => competencies.some((competency) => competency.id === link))
  ).length;

  function updateCategory(categoryId: string, updates: Partial<CompetencyCategory>) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, ...updates } : category
      )
    );
  }

  function removeCategory(categoryId: string) {
    setCategories((current) => current.filter((category) => category.id !== categoryId));
  }

  function addCompetency(categoryId: string) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              competencies: [
                ...category.competencies,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  description: ""
                }
              ]
            }
          : category
      )
    );
  }

  function updateCompetency(
    categoryId: string,
    competencyId: string,
    updates: { name?: string; description?: string }
  ) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              competencies: category.competencies.map((competency) =>
                competency.id === competencyId ? { ...competency, ...updates } : competency
              )
            }
          : category
      )
    );
  }

  function removeCompetency(categoryId: string, competencyId: string) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              competencies: category.competencies.filter(
                (competency) => competency.id !== competencyId
              )
            }
          : category
      )
    );
  }

  function handleSave() {
    const cleanedCategories = categories
      .map((category) => ({
        ...category,
        name: category.name.trim(),
        competencies: category.competencies
          .map((competency) => ({
            ...competency,
            name: competency.name.trim(),
            description: competency.description.trim()
          }))
          .filter((competency) => competency.name)
      }))
      .filter((category) => category.name || category.competencies.length);

    saveCompetencies({
      competencyLevel: level,
      competencyCategories: cleanedCategories
    });
    setMessage(
      "Competency framework saved. The assistant will use your selected level and categorized competencies for future entries."
    );
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy-block">
          <p className="eyebrow">Competencies</p>
          <h1>Define level, categories, and competencies in one place.</h1>
          <p className="hero-copy">
            Use this page to mirror how your company frames performance. Organizing competencies by
            category makes the assistant’s suggestions and summaries more useful.
          </p>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span>Current level</span>
            <strong>{level}</strong>
          </article>
          <article className="stat-card">
            <span>Categories</span>
            <strong>{categories.length}</strong>
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
            <h2>Level</h2>
            <p>Select the role level these competencies should reflect.</p>
          </div>

          <div className="level-row">
            {(["L1", "L2", "L3"] as CompetencyLevel[]).map((option) => (
              <button
                key={option}
                type="button"
                className={level === option ? "chip active" : "chip"}
                onClick={() => setLevel(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Competency categories</h2>
            <p>Create categories and then add the competencies that belong under each one.</p>
          </div>

          <div className="category-stack">
            {categories.map((category, categoryIndex) => (
              <section key={category.id} className="category-card">
                <div className="category-head">
                  <h3>Category {categoryIndex + 1}</h3>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => removeCategory(category.id)}
                  >
                    Remove category
                  </button>
                </div>

                <label>
                  Category name
                  <input
                    type="text"
                    value={category.name}
                    onChange={(event) =>
                      updateCategory(category.id, { name: event.target.value })
                    }
                    placeholder="Example: Communication and influence"
                  />
                </label>

                <div className="competency-stack">
                  {category.competencies.map((competency, competencyIndex) => (
                    <article key={competency.id} className="competency-card">
                      <div className="category-head">
                        <h4>Competency {competencyIndex + 1}</h4>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => removeCompetency(category.id, competency.id)}
                        >
                          Remove competency
                        </button>
                      </div>

                      <label>
                        Competency name
                        <input
                          type="text"
                          value={competency.name}
                          onChange={(event) =>
                            updateCompetency(category.id, competency.id, {
                              name: event.target.value
                            })
                          }
                          placeholder="Example: Communication"
                        />
                      </label>

                      <label>
                        Description
                        <textarea
                          value={competency.description}
                          onChange={(event) =>
                            updateCompetency(category.id, competency.id, {
                              description: event.target.value
                            })
                          }
                          rows={3}
                          placeholder="Example: Clearly align stakeholders around priorities, risks, and tradeoffs."
                        />
                      </label>
                    </article>
                  ))}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => addCompetency(category.id)}
                >
                  Add competency
                </button>
              </section>
            ))}
          </div>

          <div className="editor-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setCategories((current) => [...current, createCategory()])}
            >
              Add category
            </button>
            <button className="primary-button" type="button" onClick={handleSave}>
              Save competencies
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}
