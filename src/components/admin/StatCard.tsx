import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "primary" | "success" | "warning" | "info";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-yellow-500/10 text-yellow-400",
    info: "bg-blue-500/10 text-blue-400",
  };
  return (
    <Card className="glass-card">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${tones[tone]}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground truncate">{label}</p>
            <p className="text-2xl font-display font-bold truncate">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
