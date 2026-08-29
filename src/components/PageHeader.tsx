import clsx from "clsx";
import { type ReactNode } from "react";

export interface PageTab {
  id: string;
  label: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  tabs,
  activeTab,
  onTab,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tabs?: PageTab[];
  activeTab?: string;
  onTab?: (id: string) => void;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-subtle bg-[var(--surface-raised)] px-4 pt-4 pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="muted text-xs">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && tabs.length > 0 && (
        <nav className="-mb-px flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTab?.(tab.id)}
              className={clsx(
                "border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "border-sea-500 text-sea-700 dark:text-sea-200"
                  : "muted border-transparent hover:border-subtle",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}
      {!tabs && <div className="h-1" />}
    </header>
  );
}
