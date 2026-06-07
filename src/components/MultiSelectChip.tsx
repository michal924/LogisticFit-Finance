import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface MSOption { value: string; label: string; }

/**
 * Pigułka-przycisk z rozwijaną listą wielokrotnego wyboru (multiselect).
 * Styl spójny z chipami filtrów. Pusty wybór = brak filtra (wszystko).
 */
export default function MultiSelectChip({ label, options, selected, onChange, width = 200 }: {
  label: string;
  options: MSOption[];
  selected: string[];
  onChange: (vals: string[]) => void;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = selected.length > 0;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  };

  const display = !active
    ? label
    : `${label}: ${selected.length <= 2
        ? selected.map(v => options.find(o => o.value === v)?.label || v).join(', ')
        : `${selected.length} wybr.`}`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 500, border: '1px solid', cursor: 'pointer', background: active ? 'var(--accent)' : '#fff', color: active ? '#fff' : 'var(--fg-2)', borderColor: active ? 'var(--accent)' : 'var(--border)', whiteSpace: 'nowrap' }}>
        {display}
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 50, width, maxHeight: 300, overflowY: 'auto', background: '#fff', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 6px 24px rgba(14,20,48,.14)', padding: 6 }}>
          {options.map(o => {
            const checked = selected.includes(o.value);
            return (
              <button key={o.value} onClick={() => toggle(o.value)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', borderRadius: 7, background: checked ? 'var(--lf-navy-50, #f0f4ff)' : 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--fg-1)' }}
                onMouseEnter={e => (e.currentTarget.style.background = checked ? 'var(--lf-navy-100, #e6e9f5)' : 'var(--lf-slate-50, #f7f8fb)')}
                onMouseLeave={e => (e.currentTarget.style.background = checked ? 'var(--lf-navy-50, #f0f4ff)' : 'transparent')}>
                <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, background: checked ? 'var(--accent)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {checked && <Check size={12} color="#fff" />}
                </span>
                {o.label}
              </button>
            );
          })}
          {active && (
            <button onClick={() => onChange([])}
              style={{ width: '100%', textAlign: 'center', padding: '7px 10px', marginTop: 4, border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--fg-3)' }}>
              Wyczyść
            </button>
          )}
        </div>
      )}
    </div>
  );
}
