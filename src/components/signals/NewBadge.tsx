interface NewBadgeProps {
  createdAt: string;
}

export default function NewBadge({
  createdAt,
}: NewBadgeProps) {
  const age = Date.now() - new Date(createdAt).getTime();

  // Show NEW for the first minute
  if (age > 60000) return null;

  return (
    <span className="px-2 py-1 rounded-full bg-red-600 text-white text-[10px] font-bold animate-pulse">
      NEW
    </span>
  );
}
