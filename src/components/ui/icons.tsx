import React from 'react';

type IconProps = { size?: number; stroke?: number; style?: React.CSSProperties; className?: string; title?: string; };

const S = ({ size = 18, stroke = 1.75, ...rest }: IconProps, ...paths: React.ReactNode[]) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {paths}
  </svg>
);

export const Icons: Record<string, (p: IconProps) => React.ReactElement> = {
  Dashboard:     p => S(p, <rect key="a" x="3" y="3" width="7" height="9" rx="1"/>, <rect key="b" x="14" y="3" width="7" height="5" rx="1"/>, <rect key="c" x="14" y="12" width="7" height="9" rx="1"/>, <rect key="d" x="3" y="16" width="7" height="5" rx="1"/>),
  FileText:      p => S(p, <path key="a" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>, <polyline key="b" points="14 2 14 8 20 8"/>, <line key="c" x1="8" y1="13" x2="16" y2="13"/>, <line key="d" x1="8" y1="17" x2="13" y2="17"/>),
  Receipt:       p => S(p, <path key="a" d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5 4 2z"/>, <line key="b" x1="8" y1="8" x2="16" y2="8"/>, <line key="c" x1="8" y1="12" x2="16" y2="12"/>),
  Bank:          p => S(p, <line key="a" x1="3" y1="21" x2="21" y2="21"/>, <line key="b" x1="3" y1="10" x2="21" y2="10"/>, <polyline key="c" points="5 6 12 3 19 6"/>, <line key="d" x1="4" y1="10" x2="4" y2="21"/>, <line key="e" x1="20" y1="10" x2="20" y2="21"/>, <line key="f" x1="8" y1="14" x2="8" y2="17"/>, <line key="g" x1="12" y1="14" x2="12" y2="17"/>, <line key="h" x1="16" y1="14" x2="16" y2="17"/>),
  Wallet:        p => S(p, <path key="a" d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>, <path key="b" d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>, <path key="c" d="M18 12a2 2 0 0 0 0 4h4v-4z"/>),
  Users:         p => S(p, <path key="a" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>, <circle key="b" cx="9" cy="7" r="4"/>, <path key="c" d="M23 21v-2a4 4 0 0 0-3-3.87"/>, <path key="d" d="M16 3.13a4 4 0 0 1 0 7.75"/>),
  BarChart:      p => S(p, <line key="a" x1="12" y1="20" x2="12" y2="10"/>, <line key="b" x1="18" y1="20" x2="18" y2="4"/>, <line key="c" x1="6" y1="20" x2="6" y2="16"/>, <line key="d" x1="3" y1="20" x2="21" y2="20"/>),
  PieChart:      p => S(p, <path key="a" d="M21.21 15.89A10 10 0 1 1 8 2.83"/>, <path key="b" d="M22 12A10 10 0 0 0 12 2v10z"/>),
  ShieldCheck:   p => S(p, <path key="a" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, <polyline key="b" points="9 12 11 14 15 10"/>),
  Settings:      p => S(p, <circle key="a" cx="12" cy="12" r="3"/>, <path key="b" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.4.97 1.36 1.6 2.4 1.51 1.1 0 2 .9 2 2s-.9 2-2 2c-.99 0-1.84.6-2.27 1.49z"/>),
  Search:        p => S(p, <circle key="a" cx="11" cy="11" r="7"/>, <line key="b" x1="21" y1="21" x2="16.65" y2="16.65"/>),
  Bell:          p => S(p, <path key="a" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>, <path key="b" d="M13.73 21a2 2 0 0 1-3.46 0"/>),
  Plus:          p => S(p, <line key="a" x1="12" y1="5" x2="12" y2="19"/>, <line key="b" x1="5" y1="12" x2="19" y2="12"/>),
  Download:      p => S(p, <path key="a" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>, <polyline key="b" points="7 10 12 15 17 10"/>, <line key="c" x1="12" y1="15" x2="12" y2="3"/>),
  Upload:        p => S(p, <path key="a" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>, <polyline key="b" points="17 8 12 3 7 8"/>, <line key="c" x1="12" y1="3" x2="12" y2="15"/>),
  ChevronDown:   p => S(p, <polyline key="a" points="6 9 12 15 18 9"/>),
  ChevronRight:  p => S(p, <polyline key="a" points="9 18 15 12 9 6"/>),
  ChevronLeft:   p => S(p, <polyline key="a" points="15 18 9 12 15 6"/>),
  PanelLeft:     p => S(p, <rect key="a" x="3" y="3" width="18" height="18" rx="2"/>, <line key="b" x1="9" y1="3" x2="9" y2="21"/>),
  PanelLeftClose:p => S(p, <rect key="a" x="3" y="3" width="18" height="18" rx="2"/>, <line key="b" x1="9" y1="3" x2="9" y2="21"/>, <polyline key="c" points="16 15 13 12 16 9"/>),
  X:             p => S(p, <line key="a" x1="18" y1="6" x2="6" y2="18"/>, <line key="b" x1="6" y1="6" x2="18" y2="18"/>),
  Check:         p => S(p, <polyline key="a" points="20 6 9 17 4 12"/>),
  CheckCircle:   p => S(p, <path key="a" d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>, <polyline key="b" points="22 4 12 14.01 9 11.01"/>),
  AlertTriangle: p => S(p, <path key="a" d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>, <line key="b" x1="12" y1="9" x2="12" y2="13"/>, <line key="c" x1="12" y1="17" x2="12.01" y2="17"/>),
  Clock:         p => S(p, <circle key="a" cx="12" cy="12" r="9"/>, <polyline key="b" points="12 7 12 12 16 14"/>),
  Circle:        p => S(p, <circle key="a" cx="12" cy="12" r="9"/>),
  TrendUp:       p => S(p, <polyline key="a" points="22 7 13.5 15.5 8.5 10.5 2 17"/>, <polyline key="b" points="16 7 22 7 22 13"/>),
  TrendDown:     p => S(p, <polyline key="a" points="22 17 13.5 8.5 8.5 13.5 2 7"/>, <polyline key="b" points="16 17 22 17 22 11"/>),
  Arrow:         p => S(p, <line key="a" x1="5" y1="12" x2="19" y2="12"/>, <polyline key="b" points="12 5 19 12 12 19"/>),
  ArrowUpRight:  p => S(p, <line key="a" x1="7" y1="17" x2="17" y2="7"/>, <polyline key="b" points="7 7 17 7 17 17"/>),
  Filter:        p => S(p, <polygon key="a" points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>),
  Mail:          p => S(p, <rect key="a" x="3" y="5" width="18" height="14" rx="2"/>, <polyline key="b" points="3 7 12 13 21 7"/>),
  Send:          p => S(p, <line key="a" x1="22" y1="2" x2="11" y2="13"/>, <polygon key="b" points="22 2 15 22 11 13 2 9 22 2"/>),
  More:          p => S(p, <circle key="a" cx="12" cy="12" r="1"/>, <circle key="b" cx="19" cy="12" r="1"/>, <circle key="c" cx="5" cy="12" r="1"/>),
  Calendar:      p => S(p, <rect key="a" x="3" y="4" width="18" height="18" rx="2"/>, <line key="b" x1="16" y1="2" x2="16" y2="6"/>, <line key="c" x1="8" y1="2" x2="8" y2="6"/>, <line key="d" x1="3" y1="10" x2="21" y2="10"/>),
  Percent:       p => S(p, <line key="a" x1="19" y1="5" x2="5" y2="19"/>, <circle key="b" cx="6.5" cy="6.5" r="2.5"/>, <circle key="c" cx="17.5" cy="17.5" r="2.5"/>),
  Coins:         p => S(p, <circle key="a" cx="8" cy="8" r="6"/>, <path key="b" d="M18.09 10.37A6 6 0 1 1 10.34 18"/>, <path key="c" d="M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>),
  Link:          p => S(p, <path key="a" d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>, <path key="b" d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>),
  Edit:          p => S(p, <path key="a" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>, <path key="b" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>),
  Trash:         p => S(p, <polyline key="a" points="3 6 5 6 21 6"/>, <path key="b" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>),
  Eye:           p => S(p, <path key="a" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>, <circle key="b" cx="12" cy="12" r="3"/>),
  Refresh:       p => S(p, <polyline key="a" points="23 4 23 10 17 10"/>, <polyline key="b" points="1 20 1 14 7 14"/>, <path key="c" d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>),
  Activity:      p => S(p, <polyline key="a" points="22 12 18 12 15 21 9 3 6 12 2 12"/>),
};

export function Ico({ name, size = 18, stroke = 1.75, ...rest }: { name: string } & IconProps) {
  const I = Icons[name];
  if (!I) return null;
  return I({ size, stroke, ...rest });
}
