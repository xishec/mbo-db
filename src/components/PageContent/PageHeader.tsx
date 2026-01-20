import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={`w-full flex flex-wrap items-start justify-between gap-4 ${className ?? ""}`}>
      <div>
        <h1 className="text-3xl font-semibold text-default-900">{title}</h1>
        {subtitle && <p className="text-sm text-default-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
