import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NewBadgeProps {
  createdAt: string;
  className?: string;
}

const NEW_WINDOW_MS = 60_000;

/**
 * Shows a "NEW" badge for signals created within the last 60 seconds.
 * Renders nothing once the window has elapsed.
 */
export function NewBadge({ createdAt, className }: NewBadgeProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const ageMs = now - new Date(createdAt).getTime();
  const isNew = ageMs >= 0 && ageMs < NEW_WINDOW_MS;

  if (!isNew) return null;

  return (
    <Badge
      className={cn(
        "gap-1 border-transparent bg-accent text-accent-foreground animate-bounce",
        className
      )}
    >
      NEW
    </Badge>
  );
}
