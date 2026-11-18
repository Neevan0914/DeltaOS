import { useEffect, useState } from "react";

export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatTime(d: Date, h24: boolean, seconds = false) {
  return d.toLocaleTimeString(undefined, {
    hour: h24 ? "2-digit" : "numeric",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
    hour12: !h24,
  });
}
