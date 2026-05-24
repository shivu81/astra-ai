import type { Recommendation } from "@/lib/careers";

export function RecommendationCard({ rec, rank }: { rec: Recommendation; rank: number }) {
  return (
    <div
      className="rounded-3xl border border-border p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]"
      style={{ background: "var(--gradient-card)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{rec.career.emoji}</div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              #{rank} Match
            </div>
            <h3 className="text-lg font-semibold text-foreground">{rec.career.name}</h3>
          </div>
        </div>
        <div
          className="rounded-full px-3 py-1 text-sm font-bold text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          {rec.score}%
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${rec.score}%`, background: "var(--gradient-primary)" }}
        />
      </div>

      <p className="mt-4 text-sm text-foreground/90">
        <span className="font-medium text-primary">Why it fits: </span>
        {rec.reason}
      </p>

      <div className="mt-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Skills to grow
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {rec.career.improve.map((s) => (
            <span
              key={s}
              className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground/80">Future scope: </span>
        {rec.career.scope}
      </p>
    </div>
  );
}