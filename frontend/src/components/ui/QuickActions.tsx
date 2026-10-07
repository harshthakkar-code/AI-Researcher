'use client';

import { Search, ShieldCheck, Zap, Table, RefreshCw } from 'lucide-react';

interface QuickActionItem {
  id: string;
  label: string;
  prompt: string;
  icon: typeof Search;
  color: string;
  description: string;
}

const ACTIONS: QuickActionItem[] = [
  {
    id: 'sources',
    label: 'Add Sources',
    prompt: 'Search and collect more verified authoritative sources with specific dates and empirical data points.',
    icon: Search,
    color: 'from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:border-cyan-400',
    description: 'Triggers ResearcherAgent for deep harvesting',
  },
  {
    id: 'verify',
    label: 'Verify Claims',
    prompt: 'Cross-reference and verify all factual claims in this research against the primary literature.',
    icon: ShieldCheck,
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30 hover:border-emerald-400',
    description: 'Runs ValidatorAgent fact checking',
  },
  {
    id: 'concise',
    label: 'Make Concise',
    prompt: 'Make the research document concise and punchy, focusing on master tables, key metrics, and strategic takeaways.',
    icon: Zap,
    color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30 hover:border-amber-400',
    description: 'Commands WriterAgent to condense narrative',
  },
  {
    id: 'expand_table',
    label: 'Expand Matrix',
    prompt: 'Expand the master chronological data table with granular metrics, authentic local customs, and verified links.',
    icon: Table,
    color: 'from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30 hover:border-purple-400',
    description: 'Instructs WriterAgent to enrich tables',
  },
  {
    id: 'regenerate',
    label: 'Regenerate',
    prompt: 'Regenerate the entire research document from scratch incorporating all newly harvested evidence.',
    icon: RefreshCw,
    color: 'from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/30 hover:border-rose-400',
    description: 'Full multi-agent re-synthesis',
  },
];

interface QuickActionsProps {
  onSelectAction: (prompt: string) => void;
  disabled?: boolean;
}

export default function QuickActions({ onSelectAction, disabled }: QuickActionsProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Agent Actions
        </span>
        <span className="text-[10px] text-gray-500">Autonomous Execution</span>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onSelectAction(action.prompt)}
              disabled={disabled}
              title={action.description}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold bg-gradient-to-r transition-all duration-200 cursor-pointer shadow-sm ${action.color} ${
                disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'hover:scale-[1.02] active:scale-95'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
