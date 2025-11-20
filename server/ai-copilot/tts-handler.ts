import OpenAI from 'openai';

/**
 * TTS Handler - Text-to-Speech functionality using OpenAI TTS API
 * 
 * This module provides TTS capabilities for the Voice Note mode where users
 * type text and receive audio responses from the AI.
 */

export interface TTSOptions {
  model?: 'tts-1' | 'tts-1-hd';
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number; // 0.25 to 4.0
}

export interface TTSResponse {
  audioData: string; // Base64 encoded audio
  format: 'mp3';
  duration?: number;
}

/**
 * Generate speech from text using OpenAI TTS API
 * @param text - The text to convert to speech
 * @param options - TTS configuration options
 * @returns Base64 encoded audio data
 */
export async function generateSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResponse> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for TTS generation');
  }

  const {
    model = 'tts-1', // Default to standard quality (faster, cheaper)
    voice = 'alloy', // Default to alloy voice
    speed = 1.0
  } = options;

  try {
    const ttsResponse = await openai.audio.speech.create({
      model,
      voice,
      input: text,
      speed,
    });

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    const base64Audio = audioBuffer.toString('base64');

    return {
      audioData: base64Audio,
      format: 'mp3',
    };

  } catch (error: any) {
    console.error('[TTS Handler] Error generating speech:', error);
    throw new Error(`Failed to generate speech: ${error.message}`);
  }
}

/**
 * Generate speech from text with error handling and fallback
 * @param text - The text to convert to speech
 * @param options - TTS configuration options
 * @returns Base64 encoded audio data or error message as audio
 */
export async function generateSpeechSafe(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResponse> {
  try {
    return await generateSpeech(text, options);
  } catch (error: any) {
    // If TTS fails, generate an error message as audio
    console.error('[TTS Handler] Falling back to error message TTS:', error);
    
    const errorMessage = 'I apologize, but I encountered an error generating the audio response. Please try again.';
    
    try {
      return await generateSpeech(errorMessage, options);
    } catch (fallbackError: any) {
      // If even the fallback fails, throw the error
      throw new Error('TTS service is currently unavailable');
    }
  }
}

/**
 * Batch generate speech for multiple text segments
 * @param segments - Array of text segments to convert to speech
 * @param options - TTS configuration options
 * @returns Array of base64 encoded audio data
 */
export async function generateSpeechBatch(
  segments: string[],
  options: TTSOptions = {}
): Promise<TTSResponse[]> {
  const promises = segments.map(text => generateSpeech(text, options));
  return await Promise.all(promises);
}

/**
 * Estimate the duration of generated speech (rough approximation)
 * Average speaking rate: ~150 words per minute
 * @param text - The text to estimate duration for
 * @returns Estimated duration in seconds
 */
export function estimateSpeechDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  const wordsPerMinute = 150;
  const durationMinutes = words / wordsPerMinute;
  return Math.ceil(durationMinutes * 60);
}

/**
 * Validate text for TTS generation
 * @param text - The text to validate
 * @returns True if valid, false otherwise
 */
export function isValidTTSText(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const trimmed = text.trim();
  
  // Check minimum length
  if (trimmed.length === 0) {
    return false;
  }

  // Check maximum length (OpenAI limit is 4096 characters)
  if (trimmed.length > 4096) {
    return false;
  }

  return true;
}

/**
 * Truncate text to fit TTS limits if necessary
 * @param text - The text to truncate
 * @param maxLength - Maximum character length (default: 4096)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateTTSText(text: string, maxLength: number = 4096): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - 3) + '...';
}
