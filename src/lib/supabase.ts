import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
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

// Server client (for server components and API routes)
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Service role client (for admin operations - server-side only)
export function createServiceClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

// Helper: Get current user from server
export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// Helper: Get all extractions for current user
export async function getExtractions() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('extractions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching extractions:', error);
    return [];
  }
  
  return data as Extraction[];
}

// Helper: Get single extraction by ID
export async function getExtraction(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('extractions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching extraction:', error);
    return null;
  }
  
  return data as Extraction;
}

// Helper: Insert new extraction
export async function insertExtraction(extraction: ExtractionInsert) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('extractions')
    .insert(extraction as never)
    .select()
    .single();
  
  if (error) {
    console.error('Error inserting extraction:', error);
    throw error;
  }
  
  return data as Extraction;
}

// Helper: Update extraction
export async function updateExtraction(id: string, updates: Partial<ExtractionInsert>) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('extractions')
    .update(updates as never)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating extraction:', error);
    throw error;
  }
  
  return data as Extraction;
}

// Helper: Delete extraction
export async function deleteExtraction(id: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('extractions')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting extraction:', error);
    throw error;
  }
  
  return true;
}

// Helper: Upload PDF to storage
export async function uploadPdf(file: File, userId: string): Promise<{ url: string; path: string }> {
  const supabase = await createServerSupabaseClient();
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('ni43101-pdfs')
    .upload(fileName, file);
  
  if (error) {
    console.error('Error uploading PDF:', error);
    throw error;
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from('ni43101-pdfs')
    .getPublicUrl(data.path);
  
  return { url: publicUrl, path: data.path };
}
