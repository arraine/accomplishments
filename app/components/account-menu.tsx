"use client";

import { useRef, useState, useEffect } from "react";
import { useAccomplishmentsStore } from "../lib/store-provider";

export default function AccountMenu() {
  const {
    authError,
    authMode,
    isCloudConfigured,
    setAuthError,
    signIn,
    signOut,
    signUp,
    syncStatus,
    user
  } = useAccomplishmentsStore();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleSignIn() {
    await signIn(email, password);
  }

  async function handleSignUp() {
    await signUp(email, password);
  }

  return (
    <div className="account-menu-shell" ref={wrapperRef}>
      <button
        type="button"
        className="account-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-avatar" aria-hidden="true">
          {user?.email?.slice(0, 1).toUpperCase() ?? "A"}
        </span>
        <span className="account-copy">
          <strong>{user ? "Account" : "Sign in"}</strong>
          <span>{user?.email ?? "Save your data to the cloud"}</span>
        </span>
      </button>

      {open ? (
        <div className="account-menu" role="menu" aria-label="Account">
          <p className="account-status">{syncStatus}</p>

          {!isCloudConfigured ? (
            <p className="account-note">
              Add Supabase environment variables to enable sign-in and cloud save.
            </p>
          ) : null}

          {user ? (
            <button className="primary-button" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          ) : (
            <div className="account-form">
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="8+ characters"
                />
              </label>

              <div className="account-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void handleSignIn()}
                  disabled={!isCloudConfigured || authMode === "signing-in" || authMode === "signing-up"}
                >
                  {authMode === "signing-in" ? "Signing in..." : "Sign in"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void handleSignUp()}
                  disabled={!isCloudConfigured || authMode === "signing-in" || authMode === "signing-up"}
                >
                  {authMode === "signing-up" ? "Creating..." : "Create account"}
                </button>
              </div>
            </div>
          )}

          {authError ? (
            <div className="account-error">
              <span>{authError}</span>
              <button type="button" onClick={() => setAuthError(null)}>
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
