import { cn } from "../../lib/utils";
import type { BadgeTone } from "../../lib/design-tokens";

export function Badge({ tone = "neutral", dot, children, className }: {
  tone?: BadgeTone; dot?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <span className={cn(
      "badge",
      className
    )} data-tone={tone}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}
