"use client";

import { useState } from "react";
import { useAccomplishmentsStore } from "../lib/store-provider";

export default function GoalsPage() {
  const { accomplishments, currentYearAccomplishments, draftGoals, goals, loaded, saveGoals } =
    useAccomplishmentsStore();
  const [draft, setDraft] = useState(draftGoals);
  const [message, setMessage] = useState(
    "Store your current goals here. One goal per line, with an optional description after a colon."
  );

  if (!loaded) {
    return <main className="page-shell"><section className="panel"><p>Loading goals...</p></section></main>;
  }

  const linkedThisYear = currentYearAccomplishments.filter((item) =>
    item.links.some((link) => goals.some((goal) => goal.id === link))
  ).length;
  const linkedOverall = accomplishments.filter((item) =>
    item.links.some((link) => goals.some((goal) => goal.id === link))
  ).length;

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy-block">
          <p className="eyebrow">Goals</p>
          <h1>Maintain the goals your accomplishments map against.</h1>
          <p className="hero-copy">
            Keep each goal concise and stable. If needed, add a description after a colon for more
            context.
          </p>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span>Goals</span>
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
            <h2>Edit goals</h2>
            <p>Use one line per goal. Format: `Goal name: optional description`.</p>
          </div>

          <label className="large-editor">
            Goals
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={14}
              placeholder="Drive projects through ambiguity: lead difficult initiatives with clarity"
            />
          </label>

          <button
            className="primary-button"
            type="button"
            onClick={() => {
              saveGoals(draft);
              setMessage("Goals saved. New and existing accomplishments will use this goal list.");
            }}
          >
            Save goals
          </button>
        </article>
      </section>
    </main>
  );
}
