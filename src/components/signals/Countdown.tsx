import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownProps {
  closesAt: string;
  className?: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

/**
 * Live countdown to `closesAt`.
 * - Green when more than 10 minutes remain
 * - Orange when under 10 minutes remain
 * - Red when under 5 minutes remain
 * - Pulses during the final minute
 * - Shows "Expired" once the target time has passed
 */
export function Countdown({ closesAt, className }: CountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const closesAtMs = new Date(closesAt).getTime();
  const remainingMs = closesAtMs - now;
  const isExpired = remainingMs <= 0;

  const remainingMinutes = remainingMs / 60000;
  const isFinalMinute = !isExpired && remainingMinutes < 1;
  const isRed = !isExpired && remainingMinutes < 5;
  const isOrange = !isExpired && remainingMinutes >= 5 && remainingMinutes < 10;

  const colorClass = isExpired
    ? "text-muted-foreground"
    : isRed
    ? "text-destructive"
    : isOrange
    ? "text-warning"
    : "text-success";

  return (
    <span
      className={cn(
        "font-mono font-semibold tabular-nums",
        colorClass,
        isFinalMinute && "animate-pulse",
        className
      )}
      role="timer"
      aria-live="polite"
    >
      {formatRemaining(remainingMs)}
    </span>
  );
}
