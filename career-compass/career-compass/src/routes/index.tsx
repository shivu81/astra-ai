import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CAREERS,
  INTERESTS,
  SKILLS,
  scoreCareers,
  type Personality,
  type Recommendation,
  type UserProfile,
} from "@/lib/careers";
import { MessageBubble, TypingDots, type Role } from "@/components/chat/MessageBubble";
import { RecommendationCard } from "@/components/RecommendationCard";

export const Route = createFileRoute("/")({
  component: ChatPage,
});

// ---------- Question flow ----------
type Step =
  | "intro"
  | "interests"
  | "skill-rate"
  | "p-energy"
  | "p-thinking"
  | "p-role"
  | "free"
  | "result";

interface ChatMessage {
  id: string;
  role: Role;
  text?: string;
  node?: React.ReactNode;
  animated?: boolean;
}

interface Session {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
  profile: UserProfile;
  step: Step;
  skillIndex: number;
  results: Recommendation[] | null;
}

const STORAGE_KEY = "career-compass-sessions-v3";

function newSession(): Session {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    createdAt: Date.now(),
    messages: [],
    profile: { interests: [], skills: {}, personality: [] },
    step: "intro",
    skillIndex: 0,
    results: null,
  };
}

function ChatPage() {
  // Start with a stable default for SSR/hydration; load persisted sessions in an effect.
  const [sessions, setSessions] = useState<Session[]>(() => [newSession()]);
  const [activeId, setActiveId] = useState<string>(() => sessions[0].id);
  const [hydrated, setHydrated] = useState(false);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];

  // Load saved sessions after mount to avoid SSR/client text mismatches.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Session[];
        if (parsed.length) {
          setSessions(parsed);
          setActiveId(parsed[0].id);
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch {}
  }, [sessions, hydrated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active.messages, typing]);

  // Kick off intro on a fresh chat
  useEffect(() => {
    if (!hydrated) return;
    if (active.messages.length === 0 && active.step === "intro") {
      void botSay(
        "Hey 👋 I'm Career Compass. Answer a few quick questions and I'll match you to careers that fit. Let's start — which of these interest you the most?",
        () => updateActive((s) => ({ ...s, step: "interests" })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.id, hydrated]);

  function updateActive(updater: (s: Session) => Session) {
    setSessions((prev) => prev.map((s) => (s.id === active.id ? updater(s) : s)));
  }

  function pushMsg(msg: Omit<ChatMessage, "id">) {
    updateActive((s) => ({
      ...s,
      messages: [...s.messages, { id: crypto.randomUUID(), ...msg }],
    }));
  }

  async function botSay(text: string, after?: () => void) {
    setTyping(true);
    await new Promise((r) => setTimeout(r, 550));
    setTyping(false);
    pushMsg({ role: "bot", text, animated: true });
    after?.();
  }

  // ---------- Handlers per step ----------
  function handleInterests(selected: string[]) {
    pushMsg({ role: "user", text: selected.join(", ") || "(none)" });
    updateActive((s) => ({
      ...s,
      profile: { ...s.profile, interests: selected },
      step: "skill-rate",
      skillIndex: 0,
      title: s.title === "New chat" ? selected[0] ?? "Career chat" : s.title,
    }));
    void botSay(`Great. Now let's rate your skills — how would you rate yourself in ${SKILLS[0]}?`);
  }

  function handleSkillRate(rating: number) {
    const skill = SKILLS[active.skillIndex];
    pushMsg({ role: "user", text: `${skill}: ${rating}/5` });
    const nextIdx = active.skillIndex + 1;
    updateActive((s) => ({
      ...s,
      profile: { ...s.profile, skills: { ...s.profile.skills, [skill]: rating } },
      skillIndex: nextIdx,
    }));

    if (nextIdx < SKILLS.length) {
      void botSay(`Got it. How about ${SKILLS[nextIdx]}?`);
    } else {
      updateActive((s) => ({ ...s, step: "p-energy" }));
      void botSay("Now a little personality check. Where do you draw your energy from?");
    }
  }

  function handlePersonality(trait: Personality, label: string, next: Step, prompt?: string) {
    pushMsg({ role: "user", text: label });
    updateActive((s) => ({
      ...s,
      profile: { ...s.profile, personality: [...s.profile.personality, trait] },
      step: next,
    }));
    if (prompt) {
      void botSay(prompt);
    } else {
      // Finished personality → compute
      setTimeout(() => finalize(), 0);
    }
  }

  function finalize() {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== active.id) return s;
          const results = scoreCareers(s.profile).slice(0, 4);
          return {
            ...s,
            step: "result",
            results,
            messages: [
              ...s.messages,
              {
                id: crypto.randomUUID(),
                role: "bot",
                text: "Here are your top career matches based on your interests, skills and personality. 🎯",
                animated: true,
              },
            ],
          };
        }),
      );
    }, 900);
  }

  function restart() {
    updateActive(() => ({ ...newSession(), id: active.id, title: "New chat" }));
  }

  function startNewChat() {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
  }

  function deleteSession(id: string) {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh = newSession();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  async function handleFreeInput(e: React.FormEvent) {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;
    setInput("");
    pushMsg({ role: "user", text: val });
    void botSay(
      "Thanks for sharing! When you're ready, use the options above to continue the assessment, or hit ↻ Restart to start over.",
    );
  }

  // Step counter
  const totalSteps = 5;
  const stepNum = useMemo(() => {
    switch (active.step) {
      case "intro":
      case "interests":
        return 1;
      case "skill-rate":
        return 2;
      case "p-energy":
        return 3;
      case "p-thinking":
        return 4;
      case "p-role":
        return 5;
      case "result":
      case "free":
        return totalSteps;
    }
  }, [active.step]);

  return (
    <div
      className="flex h-screen text-foreground"
      style={{ background: "var(--gradient-warm)" }}
    >
      {/* Sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/60 p-4 backdrop-blur md:flex">
        <div className="mb-5 flex items-center gap-2.5 px-1 pt-1">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            C
          </div>
          <div>
            <div className="font-display text-base font-semibold leading-tight">Career Compass</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Find your fit</div>
          </div>
        </div>

        <button
          onClick={startNewChat}
          className="mb-4 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-soft)] transition hover:border-primary/40 hover:bg-secondary"
        >
          + New chat
        </button>

        <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          History
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                s.id === activeId
                  ? "bg-secondary text-foreground shadow-[var(--shadow-soft)]"
                  : "text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              <button
                onClick={() => setActiveId(s.id)}
                className="flex-1 truncate text-left"
              >
                {s.title}
              </button>
              <button
                onClick={() => deleteSession(s.id)}
                className="opacity-0 transition group-hover:opacity-60 hover:opacity-100"
                aria-label="Delete chat"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={restart}
          className="mt-3 w-full rounded-xl border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
        >
          ↻ Restart this chat
        </button>
      </aside>

      {/* Bento grid: chat + side panels */}
      <main className="flex flex-1 flex-col overflow-hidden p-3 md:p-5">
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden md:gap-4 lg:grid-cols-[1fr_320px]">
          {/* Chat panel */}
          <section
            className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)]"
            style={{ background: "var(--gradient-card)" }}
          >
            <header className="flex items-center justify-between border-b border-border/70 px-5 py-3.5">
              <div>
                <h1 className="font-display text-base font-semibold">Career chat</h1>
                <p className="text-xs text-muted-foreground">A few questions, then your matches.</p>
              </div>
              {active.step !== "result" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="hidden sm:inline">Step {stepNum} / {totalSteps}</span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:w-28">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${(stepNum / totalSteps) * 100}%`,
                        background: "var(--gradient-primary)",
                      }}
                    />
                  </div>
                </div>
              )}
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 md:px-6">
            {active.messages.map((m) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                typewrite={m.role === "bot" && m.animated ? m.text : undefined}
              >
                {m.text}
              </MessageBubble>
            ))}

            {typing && (
              <MessageBubble role="bot">
                <TypingDots />
              </MessageBubble>
            )}

            {/* Step UIs */}
            {!typing && active.step === "interests" && (
              <InterestsPicker onDone={handleInterests} />
            )}

            {!typing && active.step === "skill-rate" && (
              <SkillRater
                skill={SKILLS[active.skillIndex]}
                onRate={handleSkillRate}
              />
            )}

            {!typing && active.step === "p-energy" && (
              <ChoiceRow
                options={[
                  { label: "Time alone — Introvert", trait: "introvert" as Personality },
                  { label: "Being with people — Extrovert", trait: "extrovert" as Personality },
                ]}
                onPick={(o) =>
                  handlePersonality(
                    o.trait,
                    o.label,
                    "p-thinking",
                    "Do you lean more logical or creative when solving problems?",
                  )
                }
              />
            )}

            {!typing && active.step === "p-thinking" && (
              <ChoiceRow
                options={[
                  { label: "Logical & analytical", trait: "logical" as Personality },
                  { label: "Creative & intuitive", trait: "creative" as Personality },
                ]}
                onPick={(o) =>
                  handlePersonality(
                    o.trait,
                    o.label,
                    "p-role",
                    "Last one — in a team, are you more of a leader or a supporter?",
                  )
                }
              />
            )}

            {!typing && active.step === "p-role" && (
              <ChoiceRow
                options={[
                  { label: "Leader — I drive things", trait: "leader" as Personality },
                  { label: "Supporter — I lift the team", trait: "supporter" as Personality },
                ]}
                onPick={(o) => handlePersonality(o.trait, o.label, "result")}
              />
            )}

            {!typing && active.step === "result" && active.results && (
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                {active.results.map((r, i) => (
                  <RecommendationCard key={r.career.name} rec={r} rank={i + 1} />
                ))}
                <div className="sm:col-span-2 flex justify-center pt-2">
                  <button
                    onClick={restart}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium shadow-[var(--shadow-soft)] hover:bg-secondary"
                  >
                    Take it again
                  </button>
                </div>
              </div>
            )}
              </div>
            </div>

            {/* Input bar */}
            <form
              onSubmit={handleFreeInput}
              className="border-t border-border/70 bg-secondary/40 px-4 py-3 md:px-6"
            >
              <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-[var(--shadow-soft)] focus-within:ring-2 focus-within:ring-ring">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="rounded-xl px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition disabled:opacity-40"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  Send
                </button>
              </div>
            </form>
          </section>

          {/* Bento side panels */}
          <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto lg:flex">
            <ProfilePanel profile={active.profile} step={active.step} />
            <TopMatchPanel results={active.results} />
            <TipsPanel />
          </aside>
        </div>
      </main>
    </div>
  );
}

// ---------- Inline step UIs ----------

function InterestsPicker({ onDone }: { onDone: (selected: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (i: string) =>
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  return (
    <div className="ml-11 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap gap-2">
        {INTERESTS.map((i) => {
          const active = picked.includes(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                active
                  ? "border-transparent text-primary-foreground shadow-[var(--shadow-glow)]"
                  : "border-border bg-secondary text-secondary-foreground hover:border-primary/40"
              }`}
              style={active ? { background: "var(--gradient-primary)" } : undefined}
            >
              {i}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => onDone(picked)}
          disabled={picked.length === 0}
          className="rounded-xl px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-40"
          style={{ background: "var(--gradient-primary)" }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function SkillRater({ skill, onRate }: { skill: string; onRate: (r: number) => void }) {
  return (
    <div className="ml-11 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-2 font-display text-sm font-semibold">{skill}</div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onRate(n)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary text-sm font-semibold transition hover:border-primary hover:bg-card hover:text-primary"
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>Beginner</span>
        <span>Expert</span>
      </div>
    </div>
  );
}

function ChoiceRow<T extends { label: string }>({
  options,
  onPick,
}: {
  options: T[];
  onPick: (o: T) => void;
}) {
  return (
    <div className="ml-11 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.label}
          onClick={() => onPick(o)}
          className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-primary hover:text-primary"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Bento side panels ----------

function PanelShell({
  title,
  hint,
  children,
  tone = "card",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  tone?: "card" | "warm";
}) {
  return (
    <div
      className="rounded-3xl border border-border p-4 shadow-[var(--shadow-soft)]"
      style={{
        background: tone === "warm" ? "var(--gradient-warm)" : "var(--gradient-card)",
      }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        {hint && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ProfilePanel({ profile, step }: { profile: UserProfile; step: Step }) {
  const skillEntries = Object.entries(profile.skills);
  return (
    <PanelShell title="Your profile" hint="Live">
      <div className="space-y-3 text-xs">
        <div>
          <div className="mb-1 text-muted-foreground">Interests</div>
          {profile.interests.length ? (
            <div className="flex flex-wrap gap-1">
              {profile.interests.map((i) => (
                <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                  {i}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground/70">—</p>
          )}
        </div>

        <div>
          <div className="mb-1 text-muted-foreground">Skills</div>
          {skillEntries.length ? (
            <div className="space-y-1.5">
              {skillEntries.map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-24 truncate text-[11px]">{k}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(v / 5) * 100}%`, background: "var(--gradient-primary)" }}
                    />
                  </div>
                  <span className="w-6 text-right text-[11px] text-muted-foreground">{v}/5</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground/70">—</p>
          )}
        </div>

        <div>
          <div className="mb-1 text-muted-foreground">Personality</div>
          {profile.personality.length ? (
            <div className="flex flex-wrap gap-1">
              {profile.personality.map((p) => (
                <span key={p} className="rounded-full border border-border px-2 py-0.5 text-[11px] capitalize">
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground/70">—</p>
          )}
        </div>

        {step !== "result" && (
          <p className="pt-1 text-[10px] text-muted-foreground">
            Your answers stay on this device.
          </p>
        )}
      </div>
    </PanelShell>
  );
}

function TopMatchPanel({ results }: { results: Recommendation[] | null }) {
  if (!results || results.length === 0) {
    return (
      <PanelShell title="Top match" tone="warm">
        <p className="text-xs text-muted-foreground">
          Complete the chat to reveal your strongest career fit here.
        </p>
      </PanelShell>
    );
  }
  const top = results[0];
  return (
    <PanelShell title="Top match" hint="#1" tone="warm">
      <div className="flex items-center gap-3">
        <div className="text-3xl">{top.career.emoji}</div>
        <div className="flex-1">
          <div className="font-display text-sm font-semibold">{top.career.name}</div>
          <div className="text-[11px] text-muted-foreground">{top.score}% fit</div>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${top.score}%`, background: "var(--gradient-primary)" }}
        />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{top.reason}</p>
    </PanelShell>
  );
}

function TipsPanel() {
  return (
    <PanelShell title="How matching works">
      <ul className="space-y-2 text-[11px] text-muted-foreground">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--gradient-primary)" }} />
          <span><span className="font-semibold text-foreground">Interests</span> shape direction (30%).</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--gradient-primary)" }} />
          <span><span className="font-semibold text-foreground">Skills</span> weigh the most (40%).</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--gradient-primary)" }} />
          <span><span className="font-semibold text-foreground">Personality</span> tunes the fit (30%).</span>
        </li>
      </ul>
    </PanelShell>
  );
}