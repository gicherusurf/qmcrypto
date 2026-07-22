import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface CountdownProps {
  closesAt: string;
}

export default function Countdown({ closesAt }: CountdownProps) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      forceUpdate((n) => n + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const now = Date.now();
  const end = new Date(closesAt).getTime();

  const diff = end - now;

  if (diff <= 0) {
    return (
      <div className="flex items-center gap-2 text-red-500 font-semibold">
        <Clock className="h-4 w-4" />
        Expired
      </div>
    );
  }

  const totalSeconds = Math.floor(diff / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  let color = "text-green-500";

  if (minutes < 5) color = "text-orange-500";
  if (minutes < 1) color = "text-red-500 animate-pulse";

  return (
    <div className={`flex items-center gap-2 font-semibold ${color}`}>
      <Clock className="h-4 w-4" />
      {minutes}m {seconds}s
    </div>
  );
}
