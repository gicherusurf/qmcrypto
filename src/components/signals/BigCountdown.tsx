import { useEffect, useState } from "react";
import { Radio, Clock } from "lucide-react";
import { getNextSlotUTC, formatEatHHMM } from "@/lib/signal-schedule";

interface BigCountdownSignal {
  status: string;
  closes_at: string;
}

interface BigCountdownProps {
  signals: BigCountdownSignal[] | undefined;
}

function formatMMSS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatHHMMSS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Big, always-visible countdown at the top of the Signals page.
 * - Shows "Time Remaining MM:SS" while a signal is active.
 * - Shows "Next Signal HH:MM EAT" + a live HH:MM:SS countdown otherwise.
 * Recomputes every second so it never depends on a network refetch to
 * flip between the two states.
 */
export function BigCountdown({ signals }: BigCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const active = (signals || []).find(
    (s) => s.status === "open" && new Date(s.closes_at).getTime() > now
  );

  if (active) {
    const remaining = new Date(active.closes_at).getTime() - now;
    const isFinalMinute = remaining < 60_000;
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-6 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm text-muted-foreground mb-1">
          <Radio className="h-3.5 w-3.5 text-success animate-pulse" />
          Time Remaining
        </div>
        <div
          className={`font-display font-bold tabular-nums text-4xl sm:text-6xl text-primary ${
            isFinalMinute ? "animate-pulse" : ""
          }`}
        >
          {formatMMSS(remaining)}
        </div>
      </div>
    );
  }

  const nextSlot = getNextSlotUTC(new Date(now));
  const remaining = nextSlot.getTime() - now;

  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4 sm:p-6 text-center">
      <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm text-muted-foreground mb-1">
        <Clock className="h-3.5 w-3.5" />
        Next Signal · {formatEatHHMM(nextSlot)}
      </div>
      <div className="font-display font-bold tabular-nums text-3xl sm:text-5xl">
        {formatHHMMSS(remaining)}
      </div>
    </div>
  );
}
