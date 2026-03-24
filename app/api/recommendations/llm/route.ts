// API endpoint for LLM-enhanced recommendations
import { NextRequest, NextResponse } from 'next/server';
import {
  getEnhancedRecommendations,
  RecommendationContext,
} from '@/lib/llm-recommendations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sourceTrackId,
      currentPosition,
      userPreferences,
      recentTracks,
      limit = 10,
      minScore = 0.4,
      excludeTrackIds = [],
      useLLM = true,
    } = body;

    if (!sourceTrackId) {
      return NextResponse.json(
        { error: 'sourceTrackId is required' },
        { status: 400 }
      );
    }

    const context: RecommendationContext = {
      currentTrackId: sourceTrackId,
      currentPosition,
      userPreferences,
      recentTracks,
    };

    const recommendations = await getEnhancedRecommendations(
      sourceTrackId,
      context,
      {
        limit,
        minScore,
        excludeTrackIds,
        useLLM,
      }
    );

    return NextResponse.json({
      recommendations,
      llmAvailable: recommendations.some((r) => r.llmEnhanced),
    });
  } catch (error: any) {
    console.error('Error getting LLM-enhanced recommendations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sourceTrackId = searchParams.get('trackId');
    const currentPosition = searchParams.get('position')
      ? parseFloat(searchParams.get('position')!)
      : undefined;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const minScore = parseFloat(searchParams.get('minScore') || '0.4');
    const useLLM = searchParams.get('useLLM') !== 'false';

    if (!sourceTrackId) {
      return NextResponse.json(
        { error: 'trackId query parameter is required' },
        { status: 400 }
      );
    }

    const context: RecommendationContext = {
      currentTrackId: sourceTrackId,
      currentPosition,
    };

    const recommendations = await getEnhancedRecommendations(
      sourceTrackId,
      context,
      {
        limit,
        minScore,
        useLLM,
      }
    );

    return NextResponse.json({
      recommendations,
      llmAvailable: recommendations.some((r) => r.llmEnhanced),
    });
  } catch (error: any) {
    console.error('Error getting LLM-enhanced recommendations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}
