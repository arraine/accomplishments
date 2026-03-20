"use client";

import { useEffect, useRef, useState } from "react";

type ThemeOption = {
  id: string;
  label: string;
  description: string;
};

const STORAGE_KEY = "accomplishments-theme";

const themes: ThemeOption[] = [
  {
    id: "minimal",
    label: "Minimal and clean",
    description: "Bright, soft, and low-noise."
  },
  {
    id: "sparkly",
    label: "Cute and sparkly",
    description: "Playful color, glow, and whimsy."
  },
  {
    id: "dark",
    label: "Dark mode",
    description: "High contrast with a calm night palette."
  },
  {
    id: "sleek",
    label: "Cool and sleek",
    description: "Sharper neutrals with a modern edge."
  }
];

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("minimal");
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? "minimal";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

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

  function applyTheme(nextTheme: string) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    setOpen(false);
  }

  const currentTheme = themes.find((item) => item.id === theme) ?? themes[0];

  return (
    <div className="theme-switcher" ref={wrapperRef}>
      <button
        type="button"
        className="theme-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Change theme. Current theme: ${currentTheme.label}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="theme-toggle-icon" aria-hidden="true">
          ✦
        </span>
      </button>

      {open ? (
        <div className="theme-menu" role="menu" aria-label="Theme options">
          {themes.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={theme === option.id}
              className={theme === option.id ? "theme-option active" : "theme-option"}
              onClick={() => applyTheme(option.id)}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
