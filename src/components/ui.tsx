import clsx from "clsx";
import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { STATUS_COLOUR } from "@/domain/status";
import { type Status } from "@/domain/types";
import { useT } from "@/i18n/useT";

type Variant = "primary" | "ghost" | "outline" | "danger" | "subtle";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-sea-600 text-white hover:bg-sea-500 active:bg-sea-700 shadow-sm shadow-sea-900/20",
  outline:
    "border border-subtle bg-transparent hover:bg-sea-500/10 text-current",
  ghost: "bg-transparent hover:bg-sea-500/10 text-current",
  subtle: "bg-sea-500/10 text-sea-700 dark:text-sea-200 hover:bg-sea-500/20",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "icon";
  active?: boolean;
}

export function Button({
  variant = "outline",
  size = "md",
  active = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sea-400",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" && "h-8 px-2.5 text-xs",
        size === "md" && "h-9 px-3 text-sm",
        size === "icon" && "h-9 w-9",
        VARIANTS[variant],
        active && "bg-sea-500/20 text-sea-700 dark:text-sea-200",
        className,
      )}
    />
  );
}

export function Card({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx("panel flex flex-col", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {action}
        </header>
      )}
      <div className={clsx("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("flex flex-col gap-1", className)}>
      <span className="muted text-[11px] font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="muted text-xs">{hint}</span>}
    </label>
  );
}

const inputClasses =
  "h-9 w-full rounded-lg border border-subtle bg-transparent px-2.5 text-sm outline-none transition-colors focus:border-sea-400 focus:ring-2 focus:ring-sea-400/30";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputClasses, className)} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(inputClasses, "h-auto min-h-20 py-2", className)}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        inputClasses,
        "appearance-none bg-[var(--surface-raised)] pr-8",
        className,
      )}
    />
  );
}

export function Badge({
  children,
  colour,
  className,
}: {
  children: ReactNode;
  colour?: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        className,
      )}
      style={
        colour
          ? { backgroundColor: `${colour}22`, color: colour }
          : { backgroundColor: "var(--surface-sunken)" }
      }
    >
      {colour && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: colour }}
        />
      )}
      {children}
    </span>
  );
}

export function StatusPill({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const t = useT();
  return (
    <Badge colour={STATUS_COLOUR[status]} className={className}>
      {t(`status.${status}`)}
    </Badge>
  );
}

export function ProgressBar({
  value,
  colour = "#22c55e",
  className,
}: {
  value: number;
  colour?: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]",
        className,
      )}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
          backgroundColor: colour,
        }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-subtle px-6 py-12 text-center">
      {icon && <div className="muted mb-1">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="muted max-w-sm text-xs">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={clsx(
          "panel relative z-10 flex w-full flex-col shadow-2xl",
          width,
        )}
      >
        <header className="flex items-center justify-between border-b border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="×">
            ×
          </Button>
        </header>
        <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-subtle px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  colour,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  colour?: string;
}) {
  return (
    <div className="panel px-4 py-3">
      <p className="muted text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p
        className="mt-1 text-xl font-semibold tabular-nums"
        style={colour ? { color: colour } : undefined}
      >
        {value}
      </p>
      {sub && <p className="muted mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}

export function Toolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-1 rounded-xl border border-subtle bg-[var(--surface-raised)] p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return (
    <div className={clsx("h-6 w-px bg-[var(--border-subtle)]", className)} />
  );
}
