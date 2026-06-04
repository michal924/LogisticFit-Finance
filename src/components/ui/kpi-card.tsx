import { TrendingUp, TrendingDown } from "lucide-react";
import { Sparkline } from "./sparkline";
import type { ReactNode } from "react";

export function KpiCard({ label, value, unit, delta, deltaDir, vs, spark, sparkColor, icon }: {
  label: string; value: string; unit?: string;
  delta?: string; deltaDir?: "up" | "down"; vs?: string;
  spark?: number[]; sparkColor?: string; icon?: ReactNode;
}) {
  return (
    <div className="kpi">
      <div className="label">
        {icon && <span className="ico inline-flex">{icon}</span>}
        {label}
      </div>
      <div className="value">
        <span className="font-mono">{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
      {delta && (
        <div className="delta" data-dir={deltaDir}>
          {deltaDir === "up" ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {delta}
          {vs && <span className="vs">{vs}</span>}
        </div>
      )}
      {spark && (
        <div className="spark">
          <Sparkline values={spark} color={sparkColor ?? "var(--accent)"} />
        </div>
      )}
    </div>
  );
}
