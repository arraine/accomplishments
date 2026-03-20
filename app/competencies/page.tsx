"use client";

import { useState } from "react";
import { useAccomplishmentsStore } from "../lib/store-provider";

export default function CompetenciesPage() {
  const {
    accomplishments,
    competencies,
    currentYearAccomplishments,
    draftCompetencies,
    loaded,
    saveCompetencies
  } = useAccomplishmentsStore();
  const [draft, setDraft] = useState(draftCompetencies);
  const [message, setMessage] = useState(
    "Store your competencies here. One competency per line, with an optional description after a colon."
  );

  if (!loaded) {
    return <main className="page-shell"><section className="panel"><p>Loading competencies...</p></section></main>;
  }

  const linkedThisYear = currentYearAccomplishments.filter((item) =>
    item.links.some((link) => competencies.some((competency) => competency.id === link))
  ).length;
  const linkedOverall = accomplishments.filter((item) =>
    item.links.some((link) => competencies.some((competency) => competency.id === link))
  ).length;

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy-block">
          <p className="eyebrow">Competencies</p>
          <h1>Maintain the competencies used for categorization.</h1>
          <p className="hero-copy">
            These are the skill or behavior buckets your company cares about. The assistant uses
            them to organize accomplishments and summaries.
          </p>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span>Competencies</span>
            <strong>{competencies.length}</strong>
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
            <h2>Edit competencies</h2>
            <p>Use one line per competency. Format: `Competency: optional description`.</p>
          </div>

          <label className="large-editor">
            Competencies
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={14}
              placeholder="Communication: clearly align stakeholders around priorities and risks"
            />
          </label>

          <button
            className="primary-button"
            type="button"
            onClick={() => {
              saveCompetencies(draft);
              setMessage(
                "Competencies saved. New and existing accomplishments will use this competency list."
              );
            }}
          >
            Save competencies
          </button>
        </article>
      </section>
    </main>
  );
}
