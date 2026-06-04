import { cn } from "../../lib/utils";

const COLORS = ["navy", "green", "amber", "slate", "purple"] as const;
type AvatarColor = typeof COLORS[number];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function colorForName(name: string): AvatarColor {
  if (!name) return "slate";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function Avatar({ name, color, size = "md", className }: {
  name: string; color?: AvatarColor; size?: "sm" | "md" | "lg"; className?: string;
}) {
  const c = color ?? colorForName(name);
  return (
    <span
      className={cn("avatar", size === "sm" && "sm", size === "lg" && "lg", className)}
      data-color={c}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
