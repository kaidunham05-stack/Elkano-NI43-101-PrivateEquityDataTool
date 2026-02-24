import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { extractFromPdf, validateExtractionResponse } from '@/lib/claude';
import { transformClaudeResponseToExtraction } from '@/lib/types';

export const maxDuration = 120; // 2 minutes for PDF processing

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body (JSON with storage path)
    const body = await request.json();
    const { storagePath, originalFilename } = body as { 
      storagePath: string; 
      originalFilename: string;
    };

    if (!storagePath) {
      return NextResponse.json(
        { error: 'No storage path provided' },
        { status: 400 }
      );
    }

    // Validate that the path belongs to this user
    if (!storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: 'Unauthorized access to file' },
        { status: 403 }
      );
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('ni43101-pdfs')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return NextResponse.json(
        { error: 'Failed to download file from storage' },
        { status: 500 }
      );
    }

    // Convert to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('ni43101-pdfs')
      .getPublicUrl(storagePath);

    // Convert to base64 for Claude
    const base64 = buffer.toString('base64');
    const fileName = originalFilename || storagePath.split('/').pop() || 'document.pdf';

    // Extract data using Claude
    const extractedData = await extractFromPdf(base64);

    // Validate the response
    if (!validateExtractionResponse(extractedData)) {
      return NextResponse.json(
        { error: 'Invalid extraction response from AI' },
        { status: 500 }
      );
    }

    // Transform to database format
    const extraction = transformClaudeResponseToExtraction(
      extractedData,
      user.id,
      fileName,
      publicUrl
    );

    // Insert into database
    const { data: insertedData, error: insertError } = await supabase
      .from('extractions')
      .insert(extraction as never)
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save extraction' },
        { status: 500 }
      );
    }

    return NextResponse.json(insertedData);

  } catch (error) {
    console.error('Extraction error:', error);
    
    // Check for specific error types
    const errorMessage = error instanceof Error ? error.message : 'Extraction failed';
    let statusCode = 500;
    let userMessage = errorMessage;
    
    // Handle Anthropic API errors
    if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
      statusCode = 429;
      userMessage = 'Claude API rate limit reached. Please try again in a few minutes.';
    } else if (errorMessage.includes('authentication') || errorMessage.includes('401')) {
      statusCode = 401;
      userMessage = 'API authentication error. Please contact support.';
    } else if (errorMessage.includes('overloaded') || errorMessage.includes('503')) {
      statusCode = 503;
      userMessage = 'Claude API is temporarily overloaded. Please try again shortly.';
    } else if (errorMessage.includes('too large') || errorMessage.includes('413') || errorMessage.includes('entity')) {
      statusCode = 413;
      userMessage = 'PDF file is too large. Try a smaller file or a PDF with fewer pages.';
    } else if (errorMessage.includes('could not extract') || errorMessage.includes('corrupted')) {
      statusCode = 422;
      userMessage = errorMessage;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      statusCode = 504;
      userMessage = 'Request timed out. The PDF may be too complex. Try a smaller file.';
    }
    
    return NextResponse.json(
      { error: userMessage },
      { status: statusCode }
    );
  }
}
