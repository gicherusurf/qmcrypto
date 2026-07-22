import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LiveBadgeProps {
  isLive: boolean;
  className?: string;
}

/**
 * Displays "🟢 LIVE NOW" (pulsing) when a signal is active,
 * or "CLOSED" otherwise.
 */
export function LiveBadge({ isLive, className }: LiveBadgeProps) {
  if (isLive) {
    return (
      <Badge
        variant="default"
        className={cn("gap-1 animate-pulse", className)}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
        🟢 LIVE NOW
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={className}>
      CLOSED
    </Badge>
  );
}
