// API endpoint to check LLM service availability
import { NextResponse } from 'next/server';
import { getLLMService } from '@/lib/llm-service';

export async function GET() {
  try {
    const llmService = getLLMService();
    const isAvailable = llmService.isAvailable();

    return NextResponse.json({
      available: isAvailable,
      provider: process.env.LLM_PROVIDER || 'openai',
      model: process.env.LLM_MODEL || 'gpt-4-turbo-preview',
      cacheEnabled: process.env.LLM_CACHE_ENABLED !== 'false',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        available: false,
        error: error.message || 'LLM service not configured',
      },
      { status: 200 } // Return 200 so frontend can handle gracefully
    );
  }
}
