interface LiveBadgeProps {
  live: boolean;
}

export default function LiveBadge({
  live,
}: LiveBadgeProps) {
  if (!live) {
    return (
      <span className="px-2 py-1 rounded-full border text-xs">
        CLOSED
      </span>
    );
  }

  return (
    <span className="px-3 py-1 rounded-full bg-green-600 text-white text-xs font-bold animate-pulse">
      🟢 LIVE NOW
    </span>
  );
}
