import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import type { AppProps } from "../components/AppHost";
import { useOS } from "../os/store";

type Op = "+" | "−" | "×" | "÷" | null;

function compute(a: number, b: number, op: Op) {
  switch (op) {
    case "+": return a + b;
    case "−": return a - b;
    case "×": return a * b;
    case "÷": return b === 0 ? NaN : a / b;
    default: return b;
  }
}
const fmt = (n: number) => {
  if (!isFinite(n)) return "Error";
  const s = Number(n.toPrecision(12)).toString();
  return s.length > 14 ? n.toExponential(6) : s;
};

export function CalculatorApp({ win }: AppProps) {
  const focused = useOS((s) => s.focusedId === win.id);
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [fresh, setFresh] = useState(true);
  const [expr, setExpr] = useState("");

  const digit = (d: string) => {
    if (fresh || display === "0" || display === "Error") {
      setDisplay(d === "." ? "0." : d);
      setFresh(false);
    } else if (!(d === "." && display.includes(".")) && display.length < 15) setDisplay(display + d);
  };
  const operator = (o: Op) => {
    const cur = parseFloat(display);
    const result = acc === null || fresh ? cur : compute(acc, cur, op);
    setAcc(acc === null || !fresh ? result : acc);
    if (!fresh && acc !== null) setDisplay(fmt(result));
    setOp(o);
    setExpr(`${fmt(acc === null || !fresh ? result : acc)} ${o}`);
    setFresh(true);
  };
  const equals = () => {
    if (op === null || acc === null) return;
    const cur = parseFloat(display);
    const r = compute(acc, cur, op);
    setExpr(`${fmt(acc)} ${op} ${fmt(cur)} =`);
    setDisplay(fmt(r));
    setAcc(null);
    setOp(null);
    setFresh(true);
  };
  const clear = () => { setDisplay("0"); setAcc(null); setOp(null); setFresh(true); setExpr(""); };

  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9.]$/.test(e.key)) digit(e.key);
      else if (e.key === "+") operator("+");
      else if (e.key === "-") operator("−");
      else if (e.key === "*") operator("×");
      else if (e.key === "/") { e.preventDefault(); operator("÷"); }
      else if (e.key === "Enter" || e.key === "=") equals();
      else if (e.key === "Escape") clear();
      else if (e.key === "Backspace") setDisplay((d) => (d.length > 1 && !fresh ? d.slice(0, -1) : "0"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const K = ({ label, onClick, kind = "num", wide }: { label: React.ReactNode; onClick: () => void; kind?: "num" | "fn" | "op" | "eq"; wide?: boolean }) => (
    <button
      onClick={onClick}
      className={`h-full rounded-2xl text-[20px] font-medium transition-all active:scale-95 ${wide ? "col-span-2" : ""} ${
        kind === "op" || kind === "eq"
          ? "bg-accent text-accent-fg hover:brightness-110"
          : kind === "fn"
            ? "bg-surface-2 text-fg hover:brightness-125"
            : "bg-surface text-fg hover:bg-surface-2 border border-line"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="absolute inset-0 flex flex-col p-4 gap-4 text-fg">
      <div className="flex-[0_0_118px] flex flex-col justify-end items-end px-2">
        <div className="text-[13px] text-muted h-5 tabular-nums">{expr}</div>
        <div className="text-[46px] font-light tracking-tight tabular-nums truncate max-w-full">{display}</div>
      </div>
      <div className="flex-1 grid grid-cols-4 gap-2.5" style={{ gridAutoRows: "1fr" }}>
        <K label="AC" kind="fn" onClick={clear} />
        <K label="±" kind="fn" onClick={() => setDisplay(fmt(-parseFloat(display)))} />
        <K label="%" kind="fn" onClick={() => setDisplay(fmt(parseFloat(display) / 100))} />
        <K label="÷" kind="op" onClick={() => operator("÷")} />
        {["7", "8", "9"].map((d) => <K key={d} label={d} onClick={() => digit(d)} />)}
        <K label="×" kind="op" onClick={() => operator("×")} />
        {["4", "5", "6"].map((d) => <K key={d} label={d} onClick={() => digit(d)} />)}
        <K label="−" kind="op" onClick={() => operator("−")} />
        {["1", "2", "3"].map((d) => <K key={d} label={d} onClick={() => digit(d)} />)}
        <K label="+" kind="op" onClick={() => operator("+")} />
        <K label="0" onClick={() => digit("0")} />
        <K label="." onClick={() => digit(".")} />
        <K label={<Delete size={20} className="mx-auto" />} kind="fn" onClick={() => setDisplay((d) => (d.length > 1 && !fresh ? d.slice(0, -1) : "0"))} />
        <K label="=" kind="eq" onClick={equals} />
      </div>
    </div>
  );
}
