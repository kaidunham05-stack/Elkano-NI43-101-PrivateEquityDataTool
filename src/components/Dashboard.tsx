'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { UploadZone } from './UploadZone';
import { ExtractionsTable } from './ExtractionsTable';
import type { Extraction } from '@/lib/types';

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
            <div className="text-sm text-muted-foreground">
              {extractions.length} report{extractions.length !== 1 ? 's' : ''} analyzed
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
