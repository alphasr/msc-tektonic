// LLM Performance Optimizer
// Analyzes code and suggests optimizations

import { getLLMService, LLMMessage, extractJSONFromLLMResponse } from './llm-service';
import { promises as fs } from 'fs';
import path from 'path';

export interface OptimizationSuggestion {
  file: string;
  line?: number;
  issue: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
}

export interface PerformanceAnalysis {
  suggestions: OptimizationSuggestion[];
  summary: string;
  overallScore: number; // 0-1
}

/**
 * Analyze code for performance optimizations
 */
export async function analyzePerformance(
  filePaths: string[]
): Promise<PerformanceAnalysis> {
  const llmService = getLLMService();

  if (!llmService.isAvailable()) {
    return {
      suggestions: [],
      summary: 'LLM not available for performance analysis',
      overallScore: 0.5,
    };
  }

  try {
    // Read files
    const fileContents: Array<{ path: string; content: string }> = [];
    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        fileContents.push({ path: filePath, content });
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
      }
    }

    if (fileContents.length === 0) {
      return {
        suggestions: [],
        summary: 'No files to analyze',
        overallScore: 0.5,
      };
    }

    // Analyze with LLM
    const codeContext = fileContents
      .map((f) => `File: ${f.path}\n${f.content}`)
      .join('\n\n---\n\n');

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are a performance optimization expert. Analyze code and suggest optimizations.

Focus on:
1. Algorithm efficiency (time/space complexity)
2. Caching opportunities
3. Database query optimization
4. Memory leaks
5. Unnecessary re-renders (React)
6. API call optimization
7. Bundle size reduction

Return JSON:
{
  "suggestions": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "issue": "brief description",
      "suggestion": "how to fix",
      "priority": "high" | "medium" | "low",
      "impact": "expected improvement"
    }
  ],
  "summary": "overall assessment",
  "overallScore": 0.0-1.0
}`,
      },
      {
        role: 'user',
        content: `Analyze this code for performance optimizations:\n\n${codeContext}`,
      },
    ];

    const response = await llmService.chat(messages);
    const content = response.content;

    // Parse response
    const jsonString = extractJSONFromLLMResponse(content);

    if (jsonString) {
      const parsed = JSON.parse(jsonString);
      return parsed as PerformanceAnalysis;
    }

    return {
      suggestions: [],
      summary: 'Failed to parse LLM response',
      overallScore: 0.5,
    };
  } catch (error) {
    console.error('Error analyzing performance:', error);
    return {
      suggestions: [],
      summary: `Error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      overallScore: 0.5,
    };
  }
}

/**
 * Suggest caching strategies
 */
export async function suggestCachingStrategies(
  codeContext: string
): Promise<string[]> {
  const llmService = getLLMService();

  if (!llmService.isAvailable()) {
    return ['Enable response caching for API endpoints'];
  }

  try {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content:
          'Suggest caching strategies for the given code. Return a JSON array of suggestions.',
      },
      {
        role: 'user',
        content: codeContext,
      },
    ];

    const response = await llmService.chat(messages);
    const content = response.content;

    const jsonString = extractJSONFromLLMResponse(content);

    if (jsonString) {
      return JSON.parse(jsonString);
    }

    return [];
  } catch (error) {
    console.error('Error suggesting caching strategies:', error);
    return [];
  }
}
