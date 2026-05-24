import { useEffect, useState, type ReactNode } from "react";

export type Role = "bot" | "user";

interface Props {
  role: Role;
  children: ReactNode;
  typewrite?: string; // if provided, animates this text
}

export function MessageBubble({ role, children, typewrite }: Props) {
  const [shown, setShown] = useState(typewrite ? "" : "");

  useEffect(() => {
    if (!typewrite) return;
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(typewrite.slice(0, i));
      if (i >= typewrite.length) clearInterval(id);
    }, 12);
    return () => clearInterval(id);
  }, [typewrite]);

  const isBot = role === "bot";
  return (
    <div className={`flex w-full gap-3 ${isBot ? "" : "flex-row-reverse"}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          isBot ? "text-primary-foreground" : "bg-secondary text-secondary-foreground"
        }`}
        style={isBot ? { background: "var(--gradient-primary)" } : undefined}
      >
        {isBot ? "C" : "Y"}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isBot
            ? "rounded-tl-sm bg-card text-card-foreground border border-border"
            : "rounded-tr-sm bg-secondary text-secondary-foreground"
        }`}
      >
        {typewrite ? (
          <span className="whitespace-pre-wrap">{shown}</span>
        ) : (
          <span className="whitespace-pre-wrap">{children}</span>
        )}
      </div>
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="flex gap-1.5 px-1 py-2">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  );
}