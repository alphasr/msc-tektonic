// API endpoint for natural language queries
import { NextRequest, NextResponse } from 'next/server';
import { processNaturalLanguageQuery } from '@/lib/natural-language-query';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, sourceTrackId } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query is required and must be a string' },
        { status: 400 }
      );
    }

    const result = await processNaturalLanguageQuery(query, sourceTrackId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error processing natural language query:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process query' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const sourceTrackId = searchParams.get('trackId') || undefined;

    if (!query) {
      return NextResponse.json(
        { error: 'q query parameter is required' },
        { status: 400 }
      );
    }

    const result = await processNaturalLanguageQuery(query, sourceTrackId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error processing natural language query:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process query' },
      { status: 500 }
    );
  }
}
