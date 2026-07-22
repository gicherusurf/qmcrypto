import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  createdAt: string;
  closesAt: string;
  className?: string;
}

/**
 * Animated bar showing how much of a signal's lifetime remains,
 * derived from `createdAt` (start) and `closesAt` (end).
 */
export function ProgressBar({ createdAt, closesAt, className }: ProgressBarProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const startMs = new Date(createdAt).getTime();
  const endMs = new Date(closesAt).getTime();
  const totalMs = Math.max(endMs - startMs, 1);
  const elapsedMs = Math.min(Math.max(now - startMs, 0), totalMs);

  const remainingPercent = Math.max(0, Math.min(100, 100 - (elapsedMs / totalMs) * 100));
  const remainingMinutes = (endMs - now) / 60000;

  const barColorClass =
    remainingPercent <= 0
      ? "bg-muted-foreground"
      : remainingMinutes < 5
      ? "bg-destructive"
      : remainingMinutes < 10
      ? "bg-warning"
      : "bg-success";

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary/60", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(remainingPercent)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", barColorClass)}
        style={{ width: `${remainingPercent}%` }}
      />
    </div>
  );
}
