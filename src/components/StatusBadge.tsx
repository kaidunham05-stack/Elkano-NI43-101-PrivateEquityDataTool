'use client';

import { cn } from '@/lib/utils';
import type { Status, Priority, RiskLevel } from '@/lib/types';

// Status Badge Component
interface StatusBadgeProps {
  status: Status | null;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) return null;
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
        status === '🔍 INVESTIGATE' && "status-investigate",
        status === '👀 WATCH' && "status-watch",
        status === '❌ PASS' && "status-pass",
        className
      )}
    >
      {status}
    </span>
  );
}

// Priority Badge Component
interface PriorityBadgeProps {
  priority: Priority | null;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  if (!priority) return null;
  
  const colors: Record<Priority, string> = {
    high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    medium: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    low: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    pass: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  
  const labels: Record<Priority, string> = {
    high: 'High Priority',
    medium: 'Medium',
    low: 'Low',
    pass: 'Pass',
  };
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border",
        colors[priority],
        className
      )}
    >
      {labels[priority]}
    </span>
  );
}

// Risk Indicator Component
interface RiskIndicatorProps {
  level: RiskLevel | null;
  label?: string;
  showDot?: boolean;
  className?: string;
}

export function RiskIndicator({ level, label, showDot = true, className }: RiskIndicatorProps) {
  if (!level) return <span className="text-muted-foreground text-sm">—</span>;
  
  const colors: Record<RiskLevel, string> = {
    low: 'text-green-500',
    moderate: 'text-yellow-500',
    high: 'text-red-500',
  };
  
  const dotColors: Record<RiskLevel, string> = {
    low: 'bg-green-500',
    moderate: 'bg-yellow-500',
    high: 'bg-red-500',
  };
  
  const labels: Record<RiskLevel, string> = {
    low: 'Low',
    moderate: 'Moderate',
    high: 'High',
  };
  
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      {showDot && (
        <span className={cn("w-2 h-2 rounded-full", dotColors[level])} />
      )}
      <span className={colors[level]}>
        {label || labels[level]}
      </span>
    </span>
  );
}

// Magellan Score Badge
interface MagellanScoreProps {
  score: number | null;
  className?: string;
}

export function MagellanScore({ score, className }: MagellanScoreProps) {
  if (score === null) return <span className="text-muted-foreground">—</span>;
  
  const getColor = (s: number) => {
    if (s >= 8) return 'text-green-400 border-green-500/30 bg-green-500/10';
    if (s >= 6) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    if (s >= 4) return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    return 'text-red-400 border-red-500/30 bg-red-500/10';
  };
  
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-10 h-10 rounded-lg border text-lg font-semibold",
        getColor(score),
        className
      )}
    >
      {score}
    </span>
  );
}

// Ratio Display
interface RatioDisplayProps {
  ratio: number | null;
  className?: string;
}

export function RatioDisplay({ ratio, className }: RatioDisplayProps) {
  if (ratio === null) return <span className="text-muted-foreground">—</span>;
  
  const getColor = (r: number) => {
    if (r > 2) return 'text-green-400';
    if (r >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };
  
  const getLabel = (r: number) => {
    if (r > 2) return 'High confidence';
    if (r >= 0.5) return 'Moderate';
    return 'Low confidence';
  };
  
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <span className={cn("text-lg font-semibold", getColor(ratio))}>
        {ratio.toFixed(2)}x
      </span>
      <span className="text-xs text-muted-foreground">
        {getLabel(ratio)}
      </span>
    </span>
  );
}

// Commodity Badge
interface CommodityBadgeProps {
  commodity: string | null;
  className?: string;
}

export function CommodityBadge({ commodity, className }: CommodityBadgeProps) {
  if (!commodity) return null;
  
  const colors: Record<string, string> = {
    lithium: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    copper: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    gold: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    'rare earths': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    nickel: 'bg-green-500/15 text-green-400 border-green-500/30',
    cobalt: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };
  
  const color = colors[commodity.toLowerCase()] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize",
        color,
        className
      )}
    >
      {commodity}
    </span>
  );
}
