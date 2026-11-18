import { CheckCircle2, Info, X, AlertTriangle } from "lucide-react";
import { dismissToast, useOS } from "../os/store";
import { ClaudeMark } from "./Logo";

export function Toasts() {
  const toasts = useOS((s) => s.toasts);
  return (
    <div className="absolute top-4 right-4 z-[99000] flex flex-col gap-2.5 w-[340px] pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto glass-menu rounded-2xl p-3.5 flex gap-3 anim-slide-right text-fg">
          <div
            className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${
              t.kind === "success" ? "bg-emerald-500/20 text-emerald-400" : t.kind === "error" ? "bg-rose-500/20 text-rose-400" : t.kind === "ai" ? "text-white" : "bg-accent/20 text-accent"
            }`}
            style={t.kind === "ai" ? { background: "linear-gradient(135deg, #f0a27a, #d97757)" } : undefined}
          >
            {t.kind === "success" ? <CheckCircle2 size={17} /> : t.kind === "error" ? <AlertTriangle size={17} /> : t.kind === "ai" ? <ClaudeMark size={15} /> : <Info size={17} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold">{t.title}</div>
            {t.body && <div className="text-[12.5px] text-muted mt-0.5 break-words">{t.body}</div>}
          </div>
          <button onClick={() => dismissToast(t.id)} className="w-6 h-6 rounded-md grid place-items-center text-muted hover:text-fg hover:bg-surface-2">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
