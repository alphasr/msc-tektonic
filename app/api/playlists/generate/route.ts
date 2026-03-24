// API endpoint for AI-powered playlist generation
import { NextRequest, NextResponse } from 'next/server';
import {
  generatePlaylistFromDescription,
  PlaylistGenerationRequest,
} from '@/lib/llm-playlist-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, duration, startTrackId, preferences } = body;

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'description is required and must be a string' },
        { status: 400 }
      );
    }

    const request: PlaylistGenerationRequest = {
      description,
      duration: duration ? parseInt(duration, 10) : undefined,
      startTrackId,
      preferences,
    };

    const playlist = await generatePlaylistFromDescription(request);

    return NextResponse.json({
      playlist,
      success: true,
    });
  } catch (error: any) {
    console.error('Error generating playlist:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate playlist' },
      { status: 500 }
    );
  }
}
