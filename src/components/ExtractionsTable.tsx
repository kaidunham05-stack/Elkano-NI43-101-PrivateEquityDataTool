'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
  Download,
  Trash2,
  ExternalLink,
  FileText,
  X,
  ChevronRight,
  MapPin,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase-client';
import { StatusBadge, PriorityBadge, RiskIndicator, MagellanScore, RatioDisplay, CommodityBadge } from './StatusBadge';
import type { Extraction, ExtractionFilters, SortConfig, SortField, Status, Priority } from '@/lib/types';

interface ExtractionsTableProps {
  extractions: Extraction[];
  onDelete?: (id: string) => void;
  isLoading?: boolean;
}

export function ExtractionsTable({ 
  extractions, 
  onDelete,
  isLoading = false 
}: ExtractionsTableProps) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ExtractionFilters>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'created_at', direction: 'desc' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);

  // Get unique values for filters
  const filterOptions = useMemo(() => ({
    commodities: [...new Set(extractions.map(e => e.primary_commodity).filter(Boolean))],
    countries: [...new Set(extractions.map(e => e.country).filter(Boolean))],
    stages: [...new Set(extractions.map(e => e.report_stage).filter(Boolean))],
  }), [extractions]);

  // Filter and sort extractions
  const filteredExtractions = useMemo(() => {
    let result = [...extractions];

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(e => 
        e.project_name?.toLowerCase().includes(searchLower) ||
        e.issuer_name?.toLowerCase().includes(searchLower) ||
        e.country?.toLowerCase().includes(searchLower) ||
        e.primary_commodity?.toLowerCase().includes(searchLower)
      );
    }

    // Apply filters
    if (filters.status && filters.status !== 'all') {
      result = result.filter(e => e.status === filters.status);
    }
    if (filters.priority && filters.priority !== 'all') {
      result = result.filter(e => e.investigation_priority === filters.priority);
    }
    if (filters.commodity && filters.commodity !== 'all') {
      result = result.filter(e => e.primary_commodity === filters.commodity);
    }
    if (filters.country && filters.country !== 'all') {
      result = result.filter(e => e.country === filters.country);
    }
    if (filters.stage && filters.stage !== 'all') {
      result = result.filter(e => e.report_stage === filters.stage);
    }

    // Apply sort
    result.sort((a, b) => {
      let aVal = a[sort.field];
      let bVal = b[sort.field];
      
      // Handle nulls
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      
      // Compare
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }
      
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [extractions, search, filters, sort]);

  const handleSort = (field: SortField) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('extractions').delete().eq('id', id);
    onDelete?.(id);
    setDeleteDialogId(null);
  };

  const exportToCsv = () => {
    const headers = [
      'Date', 'Project', 'Issuer', 'Commodity', 'Country', 'Stage', 
      'Ind/Inf Ratio', 'Priority', 'Status', 'Magellan Score'
    ];
    
    const rows = filteredExtractions.map(e => [
      e.created_at ? format(new Date(e.created_at), 'yyyy-MM-dd') : '',
      e.project_name || '',
      e.issuer_name || '',
      e.primary_commodity || '',
      e.country || '',
      e.report_stage || '',
      e.ind_inf_ratio?.toString() || '',
      e.investigation_priority || '',
      e.status || '',
      e.magellan_score?.toString() || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elkano-extractions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort.field !== field) return <ChevronDown className="w-4 h-4 text-muted-foreground/50" />;
    return sort.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-primary" />
      : <ChevronDown className="w-4 h-4 text-primary" />;
  };

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects, issuers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-primary text-primary-foreground">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 glass-card">
              <div className="p-2 space-y-3">
                {/* Status filter */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                  <select
                    value={filters.status || 'all'}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as Status | 'all' }))}
                    className="w-full bg-muted border border-border rounded-md px-2 py-1 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="🔍 INVESTIGATE">🔍 INVESTIGATE</option>
                    <option value="👀 WATCH">👀 WATCH</option>
                    <option value="❌ PASS">❌ PASS</option>
                  </select>
                </div>

                {/* Priority filter */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                  <select
                    value={filters.priority || 'all'}
                    onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value as Priority | 'all' }))}
                    className="w-full bg-muted border border-border rounded-md px-2 py-1 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="pass">Pass</option>
                  </select>
                </div>

                {/* Commodity filter */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Commodity</label>
                  <select
                    value={filters.commodity || 'all'}
                    onChange={(e) => setFilters(prev => ({ ...prev, commodity: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-md px-2 py-1 text-sm"
                  >
                    <option value="all">All</option>
                    {filterOptions.commodities.map(c => (
                      <option key={c} value={c!}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Country filter */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Country</label>
                  <select
                    value={filters.country || 'all'}
                    onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-md px-2 py-1 text-sm"
                  >
                    <option value="all">All</option>
                    {filterOptions.countries.map(c => (
                      <option key={c} value={c!}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilters({})}>
                    <X className="w-4 h-4 mr-2" />
                    Clear filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export */}
          <Button variant="outline" onClick={exportToCsv} className="gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredExtractions.length} extraction{filteredExtractions.length !== 1 ? 's' : ''}
        {search && ` matching "${search}"`}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-10"></TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('created_at')}
              >
                <span className="flex items-center gap-1">
                  Date <SortIcon field="created_at" />
                </span>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('project_name')}
              >
                <span className="flex items-center gap-1">
                  Project <SortIcon field="project_name" />
                </span>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground transition-colors hidden md:table-cell"
                onClick={() => handleSort('issuer_name')}
              >
                <span className="flex items-center gap-1">
                  Issuer <SortIcon field="issuer_name" />
                </span>
              </TableHead>
              <TableHead className="hidden lg:table-cell">Commodity</TableHead>
              <TableHead className="hidden lg:table-cell">Location</TableHead>
              <TableHead className="hidden xl:table-cell">Stage</TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground transition-colors text-right hidden md:table-cell"
                onClick={() => handleSort('ind_inf_ratio')}
              >
                <span className="flex items-center gap-1 justify-end">
                  Ind/Inf <SortIcon field="ind_inf_ratio" />
                </span>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExtractions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                  No extractions found
                </TableCell>
              </TableRow>
            ) : (
              filteredExtractions.map((extraction) => (
                <ExtractionsTableRow
                  key={extraction.id}
                  extraction={extraction}
                  isExpanded={expandedId === extraction.id}
                  onToggle={() => setExpandedId(expandedId === extraction.id ? null : extraction.id)}
                  onDelete={() => setDeleteDialogId(extraction.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteDialogId} onOpenChange={() => setDeleteDialogId(null)}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>Delete Extraction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this extraction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogId(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteDialogId && handleDelete(deleteDialogId)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Individual row component
interface ExtractionsTableRowProps {
  extraction: Extraction;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function ExtractionsTableRow({ extraction, isExpanded, onToggle, onDelete }: ExtractionsTableRowProps) {
  return (
    <>
      <TableRow 
        className={cn(
          "cursor-pointer transition-colors",
          isExpanded && "bg-accent/50"
        )}
        onClick={onToggle}
      >
        <TableCell>
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </motion.div>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {extraction.created_at ? format(new Date(extraction.created_at), 'MMM d, yyyy') : '—'}
        </TableCell>
        <TableCell className="font-medium">
          {extraction.project_name || '—'}
        </TableCell>
        <TableCell className="hidden md:table-cell text-muted-foreground">
          {extraction.issuer_name || '—'}
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          <CommodityBadge commodity={extraction.primary_commodity} />
        </TableCell>
        <TableCell className="hidden lg:table-cell text-muted-foreground">
          {extraction.country ? `${extraction.country}${extraction.province_state ? `, ${extraction.province_state}` : ''}` : '—'}
        </TableCell>
        <TableCell className="hidden xl:table-cell text-muted-foreground">
          {extraction.report_stage || '—'}
        </TableCell>
        <TableCell className="text-right hidden md:table-cell">
          {extraction.ind_inf_ratio ? (
            <span className={cn(
              "font-medium",
              extraction.ind_inf_ratio > 2 && "text-green-400",
              extraction.ind_inf_ratio >= 0.5 && extraction.ind_inf_ratio <= 2 && "text-yellow-400",
              extraction.ind_inf_ratio < 0.5 && "text-red-400"
            )}>
              {extraction.ind_inf_ratio.toFixed(2)}x
            </span>
          ) : '—'}
        </TableCell>
        <TableCell>
          <StatusBadge status={extraction.status} />
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-card">
              {extraction.pdf_url && (
                <DropdownMenuItem asChild>
                  <a href={extraction.pdf_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4 mr-2" />
                    View PDF
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* Expanded detail view */}
      <AnimatePresence>
        {isExpanded && (
          <TableRow>
            <TableCell colSpan={10} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <ExtractionDetail extraction={extraction} />
              </motion.div>
            </TableCell>
          </TableRow>
        )}
      </AnimatePresence>
    </>
  );
}

// Expanded detail component
function ExtractionDetail({ extraction }: { extraction: Extraction }) {
  return (
    <div className="p-6 bg-accent/30 border-t border-border">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Left column - Project info */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Project Details
          </h4>
          <div className="space-y-3">
            <DetailItem icon={FileText} label="Report Stage" value={extraction.report_stage} />
            <DetailItem icon={Calendar} label="Effective Date" value={extraction.effective_date ? format(new Date(extraction.effective_date), 'MMM d, yyyy') : null} />
            <DetailItem icon={MapPin} label="Location" value={extraction.country ? `${extraction.country}${extraction.province_state ? `, ${extraction.province_state}` : ''}` : null} />
          </div>

          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pt-4">
            Resources
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Indicated</span>
              <span>{extraction.total_indicated_mt ? `${extraction.total_indicated_mt.toLocaleString()} Mt @ ${extraction.indicated_avg_grade || '—'}` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inferred</span>
              <span>{extraction.total_inferred_mt ? `${extraction.total_inferred_mt.toLocaleString()} Mt @ ${extraction.inferred_avg_grade || '—'}` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cutoff Grade</span>
              <span>{extraction.cutoff_grade || '—'}</span>
            </div>
          </div>
        </div>

        {/* Middle column - Economics & Risk */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Economics
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">NPV (after-tax)</span>
              <span>{extraction.npv_aftertax_musd ? `$${extraction.npv_aftertax_musd.toLocaleString()}M` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IRR (after-tax)</span>
              <span>{extraction.irr_aftertax_percent ? `${extraction.irr_aftertax_percent}%` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CapEx</span>
              <span>{extraction.capex_musd ? `$${extraction.capex_musd.toLocaleString()}M` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payback</span>
              <span>{extraction.payback_years ? `${extraction.payback_years} years` : '—'}</span>
            </div>
          </div>

          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pt-4">
            Risk Assessment
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Metallurgy</span>
              <RiskIndicator level={extraction.metallurgy_risk} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Permitting</span>
              <RiskIndicator level={extraction.permitting_risk} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Infrastructure</span>
              <RiskIndicator level={extraction.infrastructure_risk} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Geopolitical</span>
              <RiskIndicator level={extraction.geopolitical_risk} />
            </div>
          </div>
        </div>

        {/* Right column - Investment Analysis */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Investment Analysis
          </h4>
          
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Magellan Score</div>
              <MagellanScore score={extraction.magellan_score} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Ind/Inf Ratio</div>
              <RatioDisplay ratio={extraction.ind_inf_ratio} />
            </div>
          </div>

          <div className="flex gap-2">
            <PriorityBadge priority={extraction.investigation_priority} />
            <StatusBadge status={extraction.status} />
          </div>

          {extraction.priority_rationale && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm">{extraction.priority_rationale}</p>
            </div>
          )}

          {extraction.next_catalyst && (
            <div className="flex items-start gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <span className="text-muted-foreground">Next Catalyst: </span>
                <span>{extraction.next_catalyst}</span>
                {extraction.catalyst_timeline && (
                  <span className="text-muted-foreground"> ({extraction.catalyst_timeline})</span>
                )}
              </div>
            </div>
          )}

          {extraction.red_flags && extraction.red_flags.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Red Flags
              </div>
              <div className="flex flex-wrap gap-1">
                {extraction.red_flags.map((flag, i) => (
                  <Badge key={i} variant="outline" className="text-xs text-red-400 border-red-500/30 bg-red-500/10">
                    {flag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {extraction.positive_signals && extraction.positive_signals.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Positive Signals
              </div>
              <div className="flex flex-wrap gap-1">
                {extraction.positive_signals.map((signal, i) => (
                  <Badge key={i} variant="outline" className="text-xs text-green-400 border-green-500/30 bg-green-500/10">
                    {signal}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Detail item helper
function DetailItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>, label: string, value: string | null }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span>{value || '—'}</span>
    </div>
  );
}

// Loading skeleton
function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-10 w-80" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
