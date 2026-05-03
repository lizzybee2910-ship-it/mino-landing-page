import {
  Activity,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Dumbbell,
  FlaskConical,
  Heart,
  Layers,
  LucideIcon,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Dumbbell,
  FlaskConical,
  Heart,
  Layers,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  Target,
  Trophy,
  Users,
  Zap,
};

export function LearnIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICON_MAP[name] ?? BookOpen;
  return <Icon className={className} aria-hidden />;
}
