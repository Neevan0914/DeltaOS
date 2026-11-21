import { useMemo, useState } from "react";
import { Search, Check, Download, Trash2, ExternalLink, ShieldCheck } from "lucide-react";
import type { AppProps } from "../components/AppHost";
import { useOS } from "../os/store";
import { installApp, openWebApp, uninstallApp, WEB_APPS, WEB_APP_LOOK, type WebAppDef } from "../os/webapps";
import { AppIcon } from "../components/AppIcon";
import { showContextMenu } from "../os/contextMenu";
import type { WebAppCategory } from "../../shared/webapps";

const CATEGORIES: ("All" | "Installed" | WebAppCategory)[] = ["All", "Installed", "Productivity", "Creativity", "Social", "Entertainment", "Games", "Learning", "Tools"];
const FEATURED = ["vscode", "photopea", "discord", "excalidraw"];

export function Store(_props: AppProps) {
  const installed = useOS((s) => s.settings.installedApps);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");

  const apps = useMemo(() => {
    const query = q.trim().toLowerCase();
    return WEB_APPS.filter(
      (a) =>
        (cat === "All" || (cat === "Installed" ? installed.includes(a.id) : a.category === cat)) &&
        (!query || `${a.name} ${a.publisher} ${a.description} ${a.category}`.toLowerCase().includes(query)),
    );
  }, [q, cat, installed]);

  const showHero = cat === "All" && !q;
  return (
    <div className="absolute inset-0 flex flex-col text-fg">
      <div className="shrink-0 px-6 pt-5 pb-3 border-b border-line">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[22px] font-semibold tracking-tight">App Store</div>
            <div className="text-[12px] text-muted">Free web apps that run in their own DeltaOS window</div>
          </div>
          <div className="flex-1" />
          <div className="relative w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps" className="os-input w-full !pl-9 !rounded-full" />
          </div>
        </div>
        <div className="flex gap-1.5 mt-4 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`h-7 px-3 rounded-full text-[12px] font-medium shrink-0 transition-colors ${cat === c ? "bg-accent text-accent-fg" : "bg-surface border border-line text-muted hover:text-fg"}`}>
              {c}{c === "Installed" && installed.length ? ` (${installed.length})` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {showHero && (
          <div className="grid grid-cols-4 gap-3 mb-7">
            {FEATURED.map((id) => {
              const a = WEB_APPS.find((x) => x.id === id)!;
              return (
                <button key={id} onClick={() => (installed.includes(id) ? openWebApp(id) : installApp(id))}
                  className="relative h-36 rounded-2xl p-4 text-left text-white overflow-hidden group" style={{ background: WEB_APP_LOOK[id]?.gradient }}>
                  <div className="absolute -right-4 -bottom-6 opacity-25 group-hover:scale-110 transition-transform">
                    {(() => { const I = WEB_APP_LOOK[id]?.icon; return I ? <I size={110} /> : null; })()}
                  </div>
                  <div className="text-[10.5px] uppercase tracking-wider font-semibold opacity-80">Featured</div>
                  <div className="text-[16px] font-semibold mt-1">{a.name}</div>
                  <div className="text-[11.5px] opacity-85 mt-1 line-clamp-2 max-w-[85%]">{a.description}</div>
                  <div className="absolute bottom-3 left-4 text-[11.5px] font-semibold">{installed.includes(id) ? "Open →" : "Get →"}</div>
                </button>
              );
            })}
          </div>
        )}

        {apps.length === 0 ? (
          <div className="text-center text-muted text-[13px] py-16">{cat === "Installed" ? "You haven't installed any apps yet." : "No apps match your search."}</div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
            {apps.map((a) => <AppCard key={a.id} app={a} installed={installed.includes(a.id)} />)}
          </div>
        )}

        <div className="mt-8 flex items-start gap-2.5 text-[11.5px] text-muted max-w-2xl">
          <ShieldCheck size={15} className="shrink-0 mt-px text-emerald-400" />
          <span>
            These are the free web versions of each service, so they need an internet connection. Each app keeps its own sign-in, separate from Tesseract,
            and uninstalling removes it. Links to other sites open in Tesseract, and downloads stay inside DeltaOS. Windows programs (.exe) can't run in DeltaOS.
          </span>
        </div>
      </div>
    </div>
  );
}

function AppCard({ app, installed }: { app: WebAppDef; installed: boolean }) {
  return (
    <div data-store-app={app.id} className="flex gap-3.5 p-3.5 rounded-2xl bg-surface border border-line hover:border-[color-mix(in_oklab,var(--os-text)_22%,transparent)] transition-colors">
      <AppIcon app="webapp" webapp={app.id} size={52} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold truncate">{app.name}</div>
        <div className="text-[11.5px] text-muted truncate">{app.publisher} · {app.category}</div>
        <div className="text-[12px] text-muted mt-1 line-clamp-2">{app.description}</div>
      </div>
      <div className="flex flex-col items-end justify-center gap-1.5 shrink-0">
        {installed ? (
          <>
            <button onClick={() => openWebApp(app.id)} className="h-7 px-3.5 rounded-full bg-accent text-accent-fg text-[12px] font-semibold hover:brightness-110">Open</button>
            <button
              onClick={(e) => showContextMenu(e, [
                { label: "Open", icon: ExternalLink, onClick: () => openWebApp(app.id) },
                { separator: true },
                { label: "Uninstall", icon: Trash2, danger: true, onClick: () => void uninstallApp(app.id) },
              ])}
              className="text-[11px] text-muted hover:text-fg flex items-center gap-1"
            >
              <Check size={11} className="text-emerald-400" /> Installed
            </button>
          </>
        ) : (
          <button onClick={() => installApp(app.id)} aria-label={`Get ${app.name}`}
            className="h-7 px-3.5 rounded-full bg-surface-2 border border-line text-[12px] font-semibold hover:bg-accent hover:text-accent-fg hover:border-transparent flex items-center gap-1.5 transition-colors">
            <Download size={12} /> Get
          </button>
        )}
      </div>
    </div>
  );
}
