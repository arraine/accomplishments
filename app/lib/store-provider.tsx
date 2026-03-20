"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  formatAssistantNote,
  getTodayString,
  parseList,
  classifyAccomplishment,
  normalizeText
} from "./store";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase";
import type { Accomplishment, FrameworkItem, StoredState } from "./types";

type AuthMode = "idle" | "signing-in" | "signing-up" | "signed-in";

type StoreContextValue = {
  accomplishments: Accomplishment[];
  authError: string | null;
  authMode: AuthMode;
  competencies: FrameworkItem[];
  currentYearAccomplishments: Accomplishment[];
  draftCompetencies: string;
  draftGoals: string;
  framework: FrameworkItem[];
  goals: FrameworkItem[];
  isCloudConfigured: boolean;
  loaded: boolean;
  saveCompetencies: (raw: string) => void;
  saveGoals: (raw: string) => void;
  session: Session | null;
  setAccomplishments: Dispatch<SetStateAction<Accomplishment[]>>;
  setAuthError: Dispatch<SetStateAction<string | null>>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  syncStatus: string;
  today: string;
  user: User | null;
};

const STORAGE_KEY = "accomplishments-assistant-v1";

const seededGoals = [
  "Build trust with cross-functional partners",
  "Drive projects through ambiguity",
  "Create visible impact for the business"
].join("\n");

const seededCompetencies = [
  "Communication",
  "Execution",
  "Technical judgment",
  "Ownership"
].join("\n");

const StoreContext = createContext<StoreContextValue | null>(null);

function createId() {
  return crypto.randomUUID();
}

function seedState(): StoredState {
  const framework = [
    ...parseList(seededGoals, "goal"),
    ...parseList(seededCompetencies, "competency")
  ];

  const firstLinks = classifyAccomplishment(
    "Resolved three IDM support cases independently and documented the fixes.",
    framework
  );
  const secondLinks = classifyAccomplishment(
    "Presented a concise project update that aligned engineering and operations on launch risk.",
    framework
  );

  return {
    framework,
    draftGoals: seededGoals,
    draftCompetencies: seededCompetencies,
    accomplishments: [
      {
        id: createId(),
        createdAt: "2026-03-18T18:30:00.000Z",
        date: "2026-03-18",
        text: "Resolved three IDM support cases independently and documented the fixes.",
        normalized: normalizeText(
          "Resolved three IDM support cases independently and documented the fixes."
        ),
        links: [...firstLinks.goals, ...firstLinks.competencies],
        count: 3,
        history: [
          "Resolved an IDM case without escalation.",
          "Solved a second IDM case and captured the root cause.",
          "Documented the fix pattern for future cases."
        ],
        assistantNote: formatAssistantNote(firstLinks, framework, 3, true)
      },
      {
        id: createId(),
        createdAt: "2026-03-19T20:00:00.000Z",
        date: "2026-03-19",
        text: "Presented a concise project update that aligned engineering and operations on launch risk.",
        normalized: normalizeText(
          "Presented a concise project update that aligned engineering and operations on launch risk."
        ),
        links: [...secondLinks.goals, ...secondLinks.competencies],
        count: 1,
        history: [
          "Presented a concise project update that aligned engineering and operations on launch risk."
        ],
        assistantNote: formatAssistantNote(secondLinks, framework, 1, false)
      }
    ]
  };
}

function getInitialState(): StoredState {
  return {
    accomplishments: [],
    draftCompetencies: seededCompetencies,
    draftGoals: seededGoals,
    framework: []
  };
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1).getTime();
}

function coerceStoredState(value: Partial<StoredState> | null | undefined): StoredState {
  if (!value) {
    return seedState();
  }

  return {
    framework: value.framework ?? [],
    accomplishments: value.accomplishments ?? [],
    draftGoals: value.draftGoals ?? "",
    draftCompetencies: value.draftCompetencies ?? ""
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [framework, setFramework] = useState<FrameworkItem[]>([]);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [draftGoals, setDraftGoals] = useState(seededGoals);
  const [draftCompetencies, setDraftCompetencies] = useState(seededCompetencies);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("idle");
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState("Local-only mode");
  const today = getTodayString();
  const hasCloud = isSupabaseConfigured();
  const cloudLoadedUserIdRef = useRef<string | null>(null);
  const skipNextSyncRef = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      const initial = seedState();
      setFramework(initial.framework);
      setAccomplishments(initial.accomplishments);
      setLoaded(true);
      return;
    }

    const parsed = JSON.parse(saved) as StoredState;
    const nextState = coerceStoredState(parsed);
    setFramework(nextState.framework);
    setAccomplishments(nextState.accomplishments);
    setDraftGoals(nextState.draftGoals);
    setDraftCompetencies(nextState.draftCompetencies);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const state: StoredState = {
      framework,
      accomplishments,
      draftGoals,
      draftCompetencies
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [accomplishments, draftCompetencies, draftGoals, framework, loaded]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setSyncStatus("Local-only mode. Add Supabase keys to enable sign-in and cloud sync.");
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setAuthMode(data.session?.user ? "signed-in" : "idle");
      setSyncStatus(data.session?.user ? "Loading cloud data..." : "Ready to sign in");
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthMode(nextSession?.user ? "signed-in" : "idle");
      setAuthError(null);

      if (!nextSession?.user) {
        cloudLoadedUserIdRef.current = null;
        setSyncStatus("Signed out. Using local data on this browser.");
      } else {
        setSyncStatus("Loading cloud data...");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const supabaseClient = getSupabaseBrowserClient();

    if (!supabaseClient || !loaded || !user) {
      return;
    }

    const supabase = supabaseClient;
    const userId = user.id;
    const userEmail = user.email;

    if (cloudLoadedUserIdRef.current === userId) {
      return;
    }

    let cancelled = false;

    async function loadCloudState() {
      const { data, error } = await supabase
        .from("user_state")
        .select("state")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        setAuthError(error.message);
        setSyncStatus("Signed in, but cloud data could not be loaded.");
        return;
      }

      if (data?.state) {
        const nextState = coerceStoredState(data.state as StoredState);
        skipNextSyncRef.current = true;
        setFramework(nextState.framework);
        setAccomplishments(nextState.accomplishments);
        setDraftGoals(nextState.draftGoals);
        setDraftCompetencies(nextState.draftCompetencies);
        setSyncStatus(`Signed in as ${userEmail}. Cloud data loaded.`);
      } else {
        const localState: StoredState = {
          framework,
          accomplishments,
          draftGoals,
          draftCompetencies
        };

        const { error: upsertError } = await supabase.from("user_state").upsert({
          user_id: userId,
          state: localState,
          updated_at: new Date().toISOString()
        });

        if (upsertError) {
          setAuthError(upsertError.message);
          setSyncStatus("Signed in, but first cloud save failed.");
          return;
        }

        setSyncStatus(`Signed in as ${userEmail}. Local data saved to cloud.`);
      }

      cloudLoadedUserIdRef.current = userId;
    }

    loadCloudState();

    return () => {
      cancelled = true;
    };
  }, [accomplishments, draftCompetencies, draftGoals, framework, loaded, user]);

  useEffect(() => {
    const supabaseClient = getSupabaseBrowserClient();

    if (!supabaseClient || !loaded || !user) {
      return;
    }

    const supabase = supabaseClient;
    const userId = user.id;
    const userEmail = user.email;

    if (cloudLoadedUserIdRef.current !== userId) {
      return;
    }

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    const state: StoredState = {
      framework,
      accomplishments,
      draftGoals,
      draftCompetencies
    };

    const timeoutId = window.setTimeout(async () => {
      const { error } = await supabase.from("user_state").upsert({
        user_id: userId,
        state,
        updated_at: new Date().toISOString()
      });

      if (error) {
        setAuthError(error.message);
        setSyncStatus("Signed in, but sync failed.");
        return;
      }

      setSyncStatus(`Signed in as ${userEmail}. Changes saved.`);
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [accomplishments, draftCompetencies, draftGoals, framework, loaded, user]);

  const goals = useMemo(
    () => framework.filter((item) => item.kind === "goal"),
    [framework]
  );
  const competencies = useMemo(
    () => framework.filter((item) => item.kind === "competency"),
    [framework]
  );
  const currentYearAccomplishments = useMemo(() => {
    const todayTime = new Date(`${today}T12:00:00`).getTime();
    const yearStart = startOfYear(new Date(`${today}T12:00:00`));

    return accomplishments.filter((item) => {
      const itemTime = new Date(`${item.date}T12:00:00`).getTime();
      return itemTime >= yearStart && itemTime <= todayTime;
    });
  }, [accomplishments, today]);

  function saveGoals(raw: string) {
    const goalItems = parseList(raw, "goal");
    const competencyItems = framework.filter((item) => item.kind === "competency");
    setDraftGoals(raw);
    setFramework([...goalItems, ...competencyItems]);
  }

  function saveCompetencies(raw: string) {
    const goalItems = framework.filter((item) => item.kind === "goal");
    const competencyItems = parseList(raw, "competency");
    setDraftCompetencies(raw);
    setFramework([...goalItems, ...competencyItems]);
  }

  async function signIn(email: string, password: string) {
    const supabaseClient = getSupabaseBrowserClient();

    if (!supabaseClient) {
      setAuthError("Supabase is not configured yet.");
      return;
    }

    const supabase = supabaseClient;

    setAuthMode("signing-in");
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthError(error.message);
      setAuthMode("idle");
      return;
    }

    setAuthMode("signed-in");
  }

  async function signUp(email: string, password: string) {
    const supabaseClient = getSupabaseBrowserClient();

    if (!supabaseClient) {
      setAuthError("Supabase is not configured yet.");
      return;
    }

    const supabase = supabaseClient;

    setAuthMode("signing-up");
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setAuthError(error.message);
      setAuthMode("idle");
      return;
    }

    setAuthMode(data.session?.user ? "signed-in" : "idle");
    setSyncStatus(
      data.session?.user
        ? `Signed in as ${data.session.user.email}.`
        : "Account created. Check your email if confirmation is enabled."
    );
  }

  async function signOut() {
    const supabaseClient = getSupabaseBrowserClient();

    if (!supabaseClient) {
      return;
    }

    const supabase = supabaseClient;

    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setAuthMode("idle");
  }

  const value: StoreContextValue = {
    accomplishments,
    authError,
    authMode,
    competencies,
    currentYearAccomplishments,
    draftCompetencies,
    draftGoals,
    framework,
    goals,
    isCloudConfigured: hasCloud,
    loaded,
    saveCompetencies,
    saveGoals,
    session,
    setAccomplishments,
    setAuthError,
    signIn,
    signOut,
    signUp,
    syncStatus,
    today,
    user
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAccomplishmentsStore() {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error("useAccomplishmentsStore must be used within StoreProvider.");
  }

  return context;
}
