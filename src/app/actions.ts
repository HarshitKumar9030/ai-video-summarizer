/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { YoutubeTranscript } from 'youtube-transcript'
import ytdl from 'ytdl-core'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface SummaryResult {
  shortSummary: string;
  longSummary: string;
  keyPoints: string[];
}

export async function summarizeVideo(videoUrl: string): Promise<SummaryResult> {
  try {
    const videoId = getYoutubeId(videoUrl)
    if (!videoId) {
      throw new Error('Invalid YouTube URL')
    }

    const videoInfo = await ytdl.getInfo(videoId)
    const videoTitle = videoInfo.videoDetails.title
    const videoDescription = videoInfo.videoDetails.description || 'No description available.'

    const transcript = await getTranscript(videoId)
    
    if (!transcript) {
      throw new Error('Unable to fetch video transcript. The video might not have captions available.')
    }

    // Limit transcript length to avoid token limits
    const truncatedTranscript = transcript.slice(0, 10000) + (transcript.length > 10000 ? '...' : '')

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    })

    const shortSummaryPrompt = `Provide a concise summary (50-100 words) of the following YouTube video based on its transcript:

    Title: ${videoTitle}
    Transcript: ${truncatedTranscript}

    Focus on the main topic and key takeaways.`

    const longSummaryPrompt = `Provide a comprehensive summary (300-500 words) of the following YouTube video based on its transcript:

    Title: ${videoTitle}
    Description: ${videoDescription}
    Transcript: ${truncatedTranscript}

    Include main points, supporting details, and any conclusions or calls to action presented in the video.`

    const keyPointsPrompt = `List 5-7 key points from the following YouTube video transcript:

    Title: ${videoTitle}
    Transcript: ${truncatedTranscript}

    Present each point as a brief, informative statement.`

    const [shortSummary, longSummary, keyPoints] = await Promise.all([
      generateContent(model, shortSummaryPrompt),
      generateContent(model, longSummaryPrompt),
      generateContent(model, keyPointsPrompt),
    ])

    return {
      shortSummary,
      longSummary,
      keyPoints: keyPoints.split('\n').filter(point => point.trim() !== '').map(point => point.replace(/^\d+\.\s*/, '').trim()),
    }
  } catch (error) {
    console.error('Error summarizing video:', error)
    if (error instanceof Error) {
      // Provide more user-friendly error messages
      if (error.message.includes('quota')) {
        throw new Error('API quota exceeded. Please try again later.')
      } else if (error.message.includes('permission')) {
        throw new Error('Unable to access the video. It might be private or age-restricted.')
      } else if (error.message.includes('transcript')) {
        throw new Error('Unable to get video transcript. The video might not have captions available.')
      }
      throw new Error(`Failed to summarize video: ${error.message}`)
    }
    throw new Error('An unexpected error occurred while summarizing the video')
  }
}

async function generateContent(model: any, prompt: string): Promise<string> {
  const maxAttempts = 3
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts - 1) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt + 1) * 1000))
      }
    }
  }

  throw new Error(`Failed to generate content after ${maxAttempts} attempts. ${lastError?.message || ''}`)
}

async function getTranscript(videoId: string): Promise<string> {
  try {
    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId)
    return transcriptArray.map(entry => entry.text).join(' ')
  } catch (error) {
    console.error('Error fetching transcript:', error)
    return ''
  }
}

function getYoutubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}

