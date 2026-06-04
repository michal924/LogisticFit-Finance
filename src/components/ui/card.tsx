import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function CardHead({ title, sub, actions, children }: {
  title?: string; sub?: string; actions?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div>
        {title && <h3>{title}</h3>}
        {sub && <div className="head-sub">{sub}</div>}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, flush, className }: {
  children: ReactNode; flush?: boolean; className?: string;
}) {
  return <div className={cn("card-body", flush && "flush", className)}>{children}</div>;
}
