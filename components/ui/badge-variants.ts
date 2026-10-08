import { cn } from "@/lib/utils";

export const badgeVariants = (variant: string) => {
  const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  const variants = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
    outline: "text-foreground",
    critical: "bg-critical text-critical-foreground border-critical-border",
    warning: "bg-warning text-warning-foreground border-warning-border",
    healthy: "bg-healthy text-healthy-foreground border-healthy-border",
    advisory: "bg-advisory text-advisory-foreground border-advisory-border",
    info: "bg-info text-info-foreground border-info-border",
  };

  return cn(base, variants[variant as keyof typeof variants] || variants.default);
};