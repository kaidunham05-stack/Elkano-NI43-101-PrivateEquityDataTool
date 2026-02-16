'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { Download } from 'lucide-react';
import { UploadZone } from './UploadZone';
import { ExtractionsTable } from './ExtractionsTable';
import type { Extraction } from '@/lib/types';

function exportToCSV(extractions: Extraction[]) {
  const headers = [
    'Date Added', 'Issuer', 'Project', 'Primary Commodity', 'Country', 'Province',
    'Stage', 'Indicated Mt', 'Indicated Grade', 'Inferred Mt', 'Inferred Grade',
    'Ind/Inf Ratio', 'Has Economics', 'NPV (M USD)', 'IRR %', 'Met Risk',
    'Permit Risk', 'Priority', 'Next Catalyst', 'Red Flags', 'Status', 'PDF Link'
  ];
  
  const rows = extractions.map(e => [
    e.created_at ? new Date(e.created_at).toLocaleDateString() : '',
    e.issuer_name || '',
    e.project_name || '',
    e.primary_commodity || '',
    e.country || '',
    e.province_state || '',
    e.report_stage || '',
    e.total_indicated_mt || '',
    e.indicated_avg_grade || '',
    e.total_inferred_mt || '',
    e.inferred_avg_grade || '',
    e.ind_inf_ratio || '',
    e.has_economic_study ? 'Yes' : 'No',
    e.npv_aftertax_musd || '',
    e.irr_aftertax_percent || '',
    e.metallurgy_risk || '',
    e.permitting_risk || '',
    e.investigation_priority || '',
    e.next_catalyst || '',
    (e.red_flags || []).join('; '),
    e.status || '',
    e.pdf_url || ''
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `elkano-extractions-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

interface DashboardProps {
  initialExtractions: Extraction[];
}

export function Dashboard({ initialExtractions }: DashboardProps) {
  const [extractions, setExtractions] = useState<Extraction[]>(initialExtractions);

  const handleUploadComplete = (newExtraction: Extraction) => {
    setExtractions(prev => [newExtraction, ...prev]);
    toast.success('Extraction complete', {
      description: `${newExtraction.project_name || 'Report'} has been analyzed.`
    });
  };

  const handleUploadError = (error: string) => {
    toast.error('Extraction failed', {
      description: error
    });
  };

  const handleDelete = (id: string) => {
    setExtractions(prev => prev.filter(e => e.id !== id));
    toast.success('Extraction deleted');
  };

  return (
    <>
      <Toaster 
        position="bottom-right" 
        theme="dark"
        toastOptions={{
          style: {
            background: '#0A0A0A',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#FAFAFA',
          },
        }}
      />

      <div className="space-y-12">
        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            NI 43-101 Intelligence
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload technical reports for instant AI-powered analysis. Identify high-potential 
            mining projects where geological uncertainty is collapsing faster than market pricing.
          </p>
        </motion.div>

        {/* Upload zone */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <UploadZone 
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        </motion.section>

        {/* Extractions table */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Your Extractions</h2>
            <div className="flex items-center gap-4">
              {extractions.length > 0 && (
                <button
                  onClick={() => {
                    exportToCSV(extractions);
                    toast.success('CSV exported', { description: `${extractions.length} extractions downloaded.` });
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg border border-primary/20 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
              <div className="text-sm text-muted-foreground">
                {extractions.length} report{extractions.length !== 1 ? 's' : ''} analyzed
              </div>
            </div>
          </div>
          
          <ExtractionsTable 
            extractions={extractions} 
            onDelete={handleDelete}
          />
        </motion.section>

        {/* Stats summary */}
        {extractions.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard 
                label="Total Extractions" 
                value={extractions.length.toString()} 
              />
              <StatCard 
                label="Investigate" 
                value={extractions.filter(e => e.status === '🔍 INVESTIGATE').length.toString()}
                highlight
              />
              <StatCard 
                label="Watch" 
                value={extractions.filter(e => e.status === '👀 WATCH').length.toString()}
              />
              <StatCard 
                label="Pass" 
                value={extractions.filter(e => e.status === '❌ PASS').length.toString()}
              />
            </div>
          </motion.section>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-6 rounded-xl border ${highlight ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
      <div className={`text-3xl font-semibold ${highlight ? 'text-primary' : ''}`}>{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
