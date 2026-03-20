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
  classifyAccomplishment,
  flattenCompetencyCategories,
  flattenGoalObjectives,
  formatAssistantNote,
  getDefaultCompetencyLevel,
  getTodayString,
  normalizeText,
  parseLegacyCompetencies,
  parseLegacyGoals,
  parseList,
  serializeGoalObjectives,
  serializeCompetencyCategories
} from "./store";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase";
import type {
  Accomplishment,
  CompetencyCategory,
  CompetencyLevel,
  FrameworkItem,
  GoalObjective,
  StoredState
} from "./types";

type AuthMode = "idle" | "signing-in" | "signing-up" | "signed-in";

type SaveCompetenciesPayload = {
  competencyCategories: CompetencyCategory[];
  competencyLevel: CompetencyLevel;
};

type SaveGoalsPayload = {
  goalObjectives: GoalObjective[];
};

type StoreContextValue = {
  accomplishments: Accomplishment[];
  authError: string | null;
  authMode: AuthMode;
  competencies: FrameworkItem[];
  competencyCategories: CompetencyCategory[];
  competencyLevel: CompetencyLevel;
  currentYearAccomplishments: Accomplishment[];
  draftGoals: string;
  framework: FrameworkItem[];
  goalObjectives: GoalObjective[];
  goals: FrameworkItem[];
  isCloudConfigured: boolean;
  loaded: boolean;
  saveCompetencies: (payload: SaveCompetenciesPayload) => void;
  saveGoals: (payload: SaveGoalsPayload) => void;
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

const seededGoalObjectives: GoalObjective[] = [
  {
    id: "seed-goal-trust",
    objective: "Build trust with cross-functional partners",
    description: "Create dependable collaboration across teams.",
    keyResults: [
      { id: "seed-kr-trust-1", text: "Share timely project updates with partner teams." },
      { id: "seed-kr-trust-2", text: "Reduce surprises by surfacing risks early." }
    ]
  },
  {
    id: "seed-goal-ambiguity",
    objective: "Drive projects through ambiguity",
    description: "Bring clarity and momentum to complex initiatives.",
    keyResults: [
      { id: "seed-kr-ambiguity-1", text: "Define milestones and owners for uncertain work." }
    ]
  },
  {
    id: "seed-goal-impact",
    objective: "Create visible impact for the business",
    description: "Tie work to measurable outcomes and team goals.",
    keyResults: [
      { id: "seed-kr-impact-1", text: "Highlight meaningful wins and operational improvements." }
    ]
  }
];

const seededCompetencyCategories: CompetencyCategory[] = [
  {
    id: "seed-category-communication",
    name: "Communication and influence",
    competencies: [
      {
        id: "seed-competency-communication",
        name: "Communication",
        description: "Clearly align stakeholders around priorities, tradeoffs, and risks."
      }
    ]
  },
  {
    id: "seed-category-delivery",
    name: "Execution and ownership",
    competencies: [
      {
        id: "seed-competency-execution",
        name: "Execution",
        description: "Translate plans into reliable delivery."
      },
      {
        id: "seed-competency-ownership",
        name: "Ownership",
        description: "Take responsibility for outcomes and follow-through."
      }
    ]
  },
  {
    id: "seed-category-judgment",
    name: "Technical and strategic judgment",
    competencies: [
      {
        id: "seed-competency-judgment",
        name: "Technical judgment",
        description: "Make sound decisions with incomplete information."
      }
    ]
  }
];

const StoreContext = createContext<StoreContextValue | null>(null);

function createId() {
  return crypto.randomUUID();
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1).getTime();
}

function buildStateFromParts(input: {
  accomplishments: Accomplishment[];
  goalObjectives: GoalObjective[];
  competencyCategories: CompetencyCategory[];
  competencyLevel: CompetencyLevel;
}) {
  const framework = [
    ...flattenGoalObjectives(input.goalObjectives),
    ...flattenCompetencyCategories(input.competencyCategories)
  ];

  return {
    framework,
    accomplishments: input.accomplishments,
    draftGoals: serializeGoalObjectives(input.goalObjectives),
    goalObjectives: input.goalObjectives,
    draftCompetencies: serializeCompetencyCategories(input.competencyCategories),
    competencyLevel: input.competencyLevel,
    competencyCategories: input.competencyCategories
  } satisfies StoredState;
}

function seedState(): StoredState {
  const framework = [
    ...flattenGoalObjectives(seededGoalObjectives),
    ...flattenCompetencyCategories(seededCompetencyCategories)
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
    draftGoals: serializeGoalObjectives(seededGoalObjectives),
    goalObjectives: seededGoalObjectives,
    draftCompetencies: serializeCompetencyCategories(seededCompetencyCategories),
    competencyLevel: "L2",
    competencyCategories: seededCompetencyCategories,
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

function coerceStoredState(value: Partial<StoredState> | null | undefined): StoredState {
  if (!value) {
    return seedState();
  }

  const competencyCategories =
    value.competencyCategories ??
    parseLegacyCompetencies(value.draftCompetencies ?? "");
  const competencyLevel = value.competencyLevel ?? getDefaultCompetencyLevel();
  const goalObjectives = value.goalObjectives ?? parseLegacyGoals(value.draftGoals ?? "");
  const accomplishments = value.accomplishments ?? [];

  return buildStateFromParts({
    accomplishments,
    goalObjectives,
    competencyCategories,
    competencyLevel
  });
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [framework, setFramework] = useState<FrameworkItem[]>([]);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [goalObjectives, setGoalObjectives] = useState<GoalObjective[]>([]);
  const [competencyLevel, setCompetencyLevel] = useState<CompetencyLevel>(getDefaultCompetencyLevel());
  const [competencyCategories, setCompetencyCategories] = useState<CompetencyCategory[]>([]);
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
    const nextState = saved ? coerceStoredState(JSON.parse(saved) as StoredState) : seedState();

    setFramework(nextState.framework);
    setAccomplishments(nextState.accomplishments);
    setGoalObjectives(nextState.goalObjectives ?? []);
    setCompetencyLevel(nextState.competencyLevel ?? getDefaultCompetencyLevel());
    setCompetencyCategories(nextState.competencyCategories ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const state = buildStateFromParts({
      accomplishments,
      goalObjectives,
      competencyCategories,
      competencyLevel
    });

    setFramework(state.framework);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [accomplishments, competencyCategories, competencyLevel, goalObjectives, loaded]);

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
        setGoalObjectives(nextState.goalObjectives ?? []);
        setCompetencyLevel(nextState.competencyLevel ?? getDefaultCompetencyLevel());
        setCompetencyCategories(nextState.competencyCategories ?? []);
        setSyncStatus(`Signed in as ${userEmail}. Cloud data loaded.`);
      } else {
        const localState = buildStateFromParts({
          accomplishments,
          goalObjectives,
          competencyCategories,
          competencyLevel
        });

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

    void loadCloudState();

    return () => {
      cancelled = true;
    };
  }, [accomplishments, competencyCategories, competencyLevel, goalObjectives, loaded, user]);

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

    const state = buildStateFromParts({
      accomplishments,
      goalObjectives,
      competencyCategories,
      competencyLevel
    });

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
  }, [accomplishments, competencyCategories, competencyLevel, goalObjectives, loaded, user]);

  const goals = useMemo(() => framework.filter((item) => item.kind === "goal"), [framework]);
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

  function saveGoals(payload: SaveGoalsPayload) {
    setGoalObjectives(payload.goalObjectives);
  }

  function saveCompetencies(payload: SaveCompetenciesPayload) {
    setCompetencyLevel(payload.competencyLevel);
    setCompetencyCategories(payload.competencyCategories);
  }

  async function signIn(email: string, password: string) {
    const supabaseClient = getSupabaseBrowserClient();

    if (!supabaseClient) {
      setAuthError("Supabase is not configured yet.");
      return;
    }

    setAuthMode("signing-in");
    setAuthError(null);
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

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

    setAuthMode("signing-up");
    setAuthError(null);
    const { data, error } = await supabaseClient.auth.signUp({ email, password });

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

    await supabaseClient.auth.signOut();
    setSession(null);
    setUser(null);
    setAuthMode("idle");
  }

  const value: StoreContextValue = {
    accomplishments,
    authError,
    authMode,
    competencies,
    competencyCategories,
    competencyLevel,
    currentYearAccomplishments,
    draftGoals: serializeGoalObjectives(goalObjectives),
    framework,
    goalObjectives,
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
