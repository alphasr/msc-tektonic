/**
 * API Route: /api/segments/enrich
 * LLM-powered enrichment for segment suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLLMEnrichmentService } from '@/lib/ml/llm-enrichment';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      currentTrackId,
      currentPosition,
      currentFeatures,
      candidateSegments,
      mixHistory,
      deckAFeatures,
      deckBFeatures,
    } = body;

    if (!currentTrackId || !candidateSegments) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const enrichmentService = getLLMEnrichmentService();

    const prediction = await enrichmentService.enrichPredictions({
      currentTrackId,
      currentPosition: currentPosition || 0,
      currentFeatures: currentFeatures || {},
      candidateSegments,
      mixHistory: mixHistory || [],
      deckAFeatures,
      deckBFeatures,
    });

    return NextResponse.json({
      success: true,
      prediction,
    });
  } catch (error) {
    console.error('LLM enrichment error:', error);
    return NextResponse.json(
      {
        error: 'Failed to enrich predictions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
