/**
 * src/lib/design-tokens.ts — single source of truth dla designu w runtime.
 *
 * Importuj tokeny z TS jeśli musisz odwołać się do nich z kodu (np. inline
 * SVG, kolory Chart.js, dynamiczne style). NIE duplikuj wartości — jeśli
 * potrzebujesz nowego odcienia, dodaj go najpierw do `colors_and_type.css`,
 * a potem do tego pliku.
 */

export const colors = {
  // Brand
  navy:    "#3a4d98",
  navy50:  "#f3f5fb",
  navy100: "#e6e9f5",
  navy300: "#7a89c4",
  navy700: "#2f3f7c",   // ⇐ rekomendowany default dla --accent
  navy900: "#1c2650",

  green:    "#239d46",
  green100: "#e0f3e6",
  green300: "#7ec99a",
  green700: "#1b7d37",
  green900: "#0f5524",

  // Neutrals (cool slate, tinted toward navy)
  slate50:  "#f7f8fb",
  slate100: "#eef0f6",
  slate200: "#e1e4ee",
  slate300: "#c2c7d6",
  slate400: "#8a92ad",
  slate500: "#6b7392",
  slate700: "#3a4263",
  slate900: "#1b2244",
  ink:      "#0e1430",
  white:    "#ffffff",

  // Semantic
  success:    "#239d46",
  successBg:  "#e0f3e6",
  warning:    "#d28a17",
  warningBg:  "#fbf2dd",
  danger:     "#c8362d",
  dangerBg:   "#fbe5e3",
} as const;

export const fonts = {
  display: '"Poppins", system-ui, sans-serif',
  body:    '"Poppins", system-ui, sans-serif',
  mono:    '"JetBrains Mono", ui-monospace, monospace',
} as const;

export const radii = {
  xs: 4,  sm: 6,  md: 10,  lg: 14,  xl: 20,  pill: 999,
} as const;

export const spacing = {
  topbar:    56,
  sidebar:   240,
  sidebarCollapsed: 64,
  contentPad: 24,
  cardPad:    20,
} as const;

export const motion = {
  easeOut:   "cubic-bezier(0.22, 0.61, 0.36, 1)",
  easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  fast:      120,
  base:      180,
  slow:      320,
} as const;

export const shadows = {
  xs:    "0 1px 2px rgba(14, 20, 48, 0.06)",
  sm:    "0 2px 6px rgba(14, 20, 48, 0.06), 0 1px 2px rgba(14, 20, 48, 0.04)",
  md:    "0 6px 16px rgba(14, 20, 48, 0.08), 0 2px 4px rgba(14, 20, 48, 0.04)",
  lg:    "0 18px 40px rgba(14, 20, 48, 0.10), 0 6px 12px rgba(14, 20, 48, 0.06)",
  focus: "0 0 0 3px rgba(58, 77, 152, 0.28)",
} as const;

/* ─── Roles + ACL ────────────────────────────────────────────── */

export type Role = "admin" | "sales" | "audytor" | "implementation";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  sales: "Sales",
  audytor: "Audytor",
  implementation: "Implementation",
};

export type View =
  | "dashboard" | "offers" | "pipeline" | "audits"
  | "implementation" | "documents" | "templates" | "settings";

/**
 * Czy rola ma dostęp do widoku. "*" = każda zalogowana rola.
 * (To samo było ustalone w prototypie — zachowaj 1:1.)
 */
export const VIEW_ACL: Record<View, Role[] | "*"> = {
  dashboard:      "*",
  offers:         ["admin", "sales"],
  pipeline:       ["admin", "sales"],
  audits:         ["admin", "audytor"],
  implementation: ["admin", "implementation"],
  documents:      "*",
  templates:      ["admin", "sales", "implementation"],
  settings:       ["admin"],
};

/** Domyślny landing per rola (przy zmianie roli wymuś jeden z dostępnych). */
export const DEFAULT_VIEW: Record<Role, View> = {
  admin:          "dashboard",
  sales:          "pipeline",
  audytor:        "audits",
  implementation: "implementation",
};

export function canSeeView(view: View, role: Role): boolean {
  const acl = VIEW_ACL[view];
  return acl === "*" || acl.includes(role);
}

/* ─── Status maps (oferty, pipeline, audyt) ──────────────────── */

export type OfferStatus = "draft" | "sent" | "nego" | "won" | "lost";

export const OFFER_STATUS: Record<OfferStatus, { tone: BadgeTone; pl: string; en: string }> = {
  draft:  { tone: "neutral", pl: "Robocza",    en: "Draft" },
  sent:   { tone: "info",    pl: "Wysłana",    en: "Sent" },
  nego:   { tone: "warning", pl: "Negocjacje", en: "Negotiation" },
  won:    { tone: "success", pl: "Wygrana",    en: "Won" },
  lost:   { tone: "danger",  pl: "Przegrana",  en: "Lost" },
};

export type PipelineStage = "lead" | "contact" | "proposal" | "nego" | "won";

export const PIPELINE_STAGES: Record<PipelineStage, { pl: string; en: string; bg: string; fg: string }> = {
  lead:     { pl: "Lead",       en: "Lead",        bg: colors.slate100,  fg: colors.slate500 },
  contact:  { pl: "Kontakt",    en: "Contact",     bg: "#eef1f8",        fg: colors.navy700 },
  proposal: { pl: "Oferta",     en: "Proposal",    bg: "#fbf5e6",        fg: "#8a5a0e" },
  nego:     { pl: "Negocjacje", en: "Negotiation", bg: colors.warningBg, fg: colors.warning },
  won:      { pl: "Wygrane",    en: "Won",         bg: colors.green100,  fg: colors.green900 },
};

export type BadgeTone = "info" | "success" | "warning" | "danger" | "neutral" | "outline";

/* ─── Envs ───────────────────────────────────────────────────── */

export type Env = "prod" | "staging";

export const ENV_LABELS: Record<Env, { label: string; bg: string; fg: string; border: string }> = {
  prod:    { label: "PROD",    bg: colors.green100, fg: colors.green900, border: colors.green300 },
  staging: { label: "STAGING", bg: colors.warningBg, fg: "#8a5a0e",      border: "#f3d586" },
};
