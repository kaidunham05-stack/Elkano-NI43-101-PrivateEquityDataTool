'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Extraction, ExtractionInsert } from './types';

// Type definitions for Supabase
export type Database = {
  public: {
    Tables: {
      extractions: {
        Row: Extraction;
        Insert: ExtractionInsert;
        Update: Partial<ExtractionInsert>;
      };
    };
  };
};

let supabaseClient: SupabaseClient<Database> | null = null;

// Browser client (for client components)
// Singleton pattern to avoid creating multiple clients
export function createClient(): SupabaseClient<Database> {
  // Only create client on the browser
  if (typeof window === 'undefined') {
    // Return a mock/placeholder during SSR
    // The real client will be created on the browser
    return {} as SupabaseClient<Database>;
  }
  
  if (supabaseClient) {
    return supabaseClient;
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  supabaseClient = createBrowserClient<Database>(supabaseUrl, supabaseKey);
  return supabaseClient;
}
