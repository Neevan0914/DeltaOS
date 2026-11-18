import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function Button({
  variant = "default",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "accent" | "ghost" | "danger" }) {
  const styles = {
    default: "bg-surface-2 hover:bg-[color-mix(in_oklab,var(--os-text)_14%,transparent)] border border-line text-fg",
    accent: "bg-accent text-accent-fg hover:brightness-110 shadow-[0_6px_20px_-8px_var(--os-accent)]",
    ghost: "hover:bg-surface-2 text-fg",
    danger: "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/25",
  }[variant];
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 h-8 px-3.5 rounded-lg text-[13px] font-medium transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  className = "",
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      className={`w-8 h-8 grid place-items-center rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none ${
        active ? "bg-accent/20 text-accent" : "text-muted hover:text-fg hover:bg-surface-2"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ${checked ? "bg-accent" : "bg-surface-2 border border-line"}`}
    >
      <span
        className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(18px)" : "none" }}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-surface border border-line gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`h-7 px-3 rounded-lg text-[12.5px] font-medium flex items-center gap-1.5 transition-all ${
            value === o.value ? "bg-accent text-accent-fg shadow" : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Inline rename/create input. Commits on Enter/blur, cancels on Escape. */
export function InlineInput({
  initial,
  onCommit,
  onCancel,
  className = "",
}: {
  initial: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const dot = initial.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit && v.trim() && v.trim() !== initial) onCommit(v.trim());
    else onCancel();
  };
  return (
    <input
      ref={ref}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      }}
      onBlur={() => finish(true)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`os-input !py-0.5 !px-1.5 !rounded-md text-center ${className}`}
    />
  );
}
