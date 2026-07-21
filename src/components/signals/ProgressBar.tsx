import { useEffect, useState } from "react";

interface ProgressBarProps {
  createdAt: string;
  closesAt: string;
}

export default function ProgressBar({
  createdAt,
  closesAt,
}: ProgressBarProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const start = new Date(createdAt).getTime();
  const end = new Date(closesAt).getTime();
  const now = Date.now();

  const total = end - start;
  const remaining = Math.max(0, end - now);

  const percent =
    total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  let color = "bg-green-500";

  if (percent < 50) color = "bg-yellow-500";
  if (percent < 20) color = "bg-red-500";

  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={`${color} h-full transition-all duration-1000`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
