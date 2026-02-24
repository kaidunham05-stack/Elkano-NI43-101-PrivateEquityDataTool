'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader2,
  CloudUpload,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase-client';
import type { UploadState, UploadProgress, Extraction } from '@/lib/types';

interface UploadZoneProps {
  onUploadComplete?: (extraction: Extraction) => void;
  onUploadError?: (error: string) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const stateMessages: Record<UploadState, string> = {
  idle: 'Drop your NI 43-101 PDF here',
  validating: 'Validating file...',
  uploading: 'Uploading to secure storage...',
  processing: 'Preparing document for analysis...',
  extracting: 'Claude is analyzing the report...',
  saving: 'Saving extraction results...',
  complete: 'Analysis complete!',
  error: 'Something went wrong',
};

const stateIcons: Record<UploadState, React.ReactNode> = {
  idle: <CloudUpload className="w-12 h-12" />,
  validating: <Loader2 className="w-12 h-12 animate-spin" />,
  uploading: <Upload className="w-12 h-12 animate-pulse" />,
  processing: <FileText className="w-12 h-12 animate-pulse" />,
  extracting: <Sparkles className="w-12 h-12 animate-pulse" />,
  saving: <Loader2 className="w-12 h-12 animate-spin" />,
  complete: <CheckCircle className="w-12 h-12" />,
  error: <XCircle className="w-12 h-12" />,
};

export function UploadZone({ onUploadComplete, onUploadError }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({
    state: 'idle',
    message: stateMessages.idle,
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    // Validate
    setProgress({ state: 'validating', message: stateMessages.validating });
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setProgress({ 
        state: 'error', 
        message: 'Please upload a PDF file',
        error: 'Invalid file type'
      });
      onUploadError?.('Invalid file type');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setProgress({ 
        state: 'error', 
        message: 'File too large (max 50MB)',
        error: 'File size exceeds limit'
      });
      onUploadError?.('File too large');
      return;
    }

    try {
      const supabase = createClient();
      
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Please log in to upload files');
      }

      // Upload directly to Supabase Storage (bypasses Vercel body limits)
      setProgress({ state: 'uploading', message: 'Uploading PDF to secure storage...', progress: 10 });
      
      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ni43101-pdfs')
        .upload(fileName, file, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Failed to upload file to storage');
      }

      setProgress({ state: 'processing', message: stateMessages.processing, progress: 30 });
      
      // Call API with storage path (not the file - avoids Vercel limits)
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          storagePath: uploadData.path,
          originalFilename: file.name 
        }),
      });

      setProgress({ state: 'extracting', message: stateMessages.extracting, progress: 60 });

      if (!response.ok) {
        let errorMessage = 'Extraction failed';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // Response wasn't valid JSON - try to get text
          try {
            const text = await response.text();
            errorMessage = text || `Server error (${response.status})`;
          } catch {
            errorMessage = `Server error (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      setProgress({ state: 'saving', message: stateMessages.saving, progress: 90 });
      
      const extraction = await response.json();

      setProgress({ state: 'complete', message: stateMessages.complete, progress: 100 });
      onUploadComplete?.(extraction);

      // Reset after a delay
      setTimeout(() => {
        setProgress({ state: 'idle', message: stateMessages.idle });
      }, 3000);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setProgress({ 
        state: 'error', 
        message: message,
        error: message
      });
      onUploadError?.(message);
      
      // Reset after a delay
      setTimeout(() => {
        setProgress({ state: 'idle', message: stateMessages.idle });
      }, 5000);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    // Reset input
    e.target.value = '';
  }, []);

  const isProcessing = !['idle', 'complete', 'error'].includes(progress.state);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full"
    >
      <div
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-all duration-300",
          "p-12 flex flex-col items-center justify-center text-center",
          "cursor-pointer group min-h-[280px]",
          isDragging && "border-primary bg-primary/5 scale-[1.02]",
          progress.state === 'idle' && "border-border hover:border-primary/50 hover:bg-accent/50",
          progress.state === 'error' && "border-destructive/50 bg-destructive/5",
          progress.state === 'complete' && "border-green-500/50 bg-green-500/5",
          isProcessing && "border-primary/50 bg-primary/5",
          isProcessing && "pointer-events-none"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!isProcessing) {
            document.getElementById('file-input')?.click();
          }
        }}
      >
        {/* Ambient glow effect */}
        <AnimatePresence>
          {(isDragging || isProcessing) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-2xl glow-orange pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Icon */}
        <motion.div
          key={progress.state}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={cn(
            "mb-6",
            progress.state === 'idle' && "text-muted-foreground group-hover:text-primary transition-colors",
            progress.state === 'error' && "text-destructive",
            progress.state === 'complete' && "text-green-500",
            isProcessing && "text-primary"
          )}
        >
          {stateIcons[progress.state]}
        </motion.div>

        {/* Message */}
        <motion.p
          key={progress.message}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={cn(
            "text-lg font-medium mb-2",
            progress.state === 'error' && "text-destructive",
            progress.state === 'complete' && "text-green-500"
          )}
        >
          {progress.message}
        </motion.p>

        {/* Sub-message */}
        {progress.state === 'idle' && (
          <p className="text-sm text-muted-foreground">
            or click to browse • PDF up to 50MB
          </p>
        )}

        {/* Progress bar */}
        {isProcessing && progress.progress !== undefined && (
          <div className="w-full max-w-xs mt-6">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {progress.progress}% complete
            </p>
          </div>
        )}

        {/* Error details */}
        {progress.state === 'error' && progress.error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mt-4 text-sm text-destructive/80"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Click to try again</span>
          </motion.div>
        )}

        {/* Hidden file input */}
        <input
          id="file-input"
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isProcessing}
        />
      </div>
    </motion.div>
  );
}
