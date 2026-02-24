import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        step: 'auth',
        error: authError?.message || 'No user',
        status: 'failed'
      });
    }

    // Check storage bucket exists and is accessible
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      return NextResponse.json({
        step: 'list_buckets',
        error: bucketsError.message,
        status: 'failed'
      });
    }

    const pdfBucket = buckets?.find(b => b.id === 'ni43101-pdfs');
    
    // Try listing files in user's folder
    const { data: files, error: listError } = await supabase.storage
      .from('ni43101-pdfs')
      .list(user.id, { limit: 5 });

    // Check database connection
    const { data: extractions, error: dbError } = await supabase
      .from('extractions')
      .select('id')
      .limit(1);

    return NextResponse.json({
      status: 'ok',
      user_id: user.id,
      bucket_exists: !!pdfBucket,
      bucket_public: pdfBucket?.public,
      files_in_folder: files?.length ?? 0,
      list_error: listError?.message,
      db_connected: !dbError,
      db_error: dbError?.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      step: 'unknown',
      error: error instanceof Error ? error.message : String(error),
      status: 'failed'
    });
  }
}
