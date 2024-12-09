'use server'

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { YoutubeTranscript } from 'youtube-transcript'
import ytdl from 'ytdl-core'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function summarizeVideo(videoUrl: string): Promise<string> {
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
    const truncatedTranscript = transcript.slice(0, 8000) + (transcript.length > 8000 ? '...' : '')

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

    const prompt = `Summarize the following YouTube video based primarily on its transcript, with context from the title and description:

    Title: ${videoTitle}
    Description: ${videoDescription}
    
    Transcript:
    ${truncatedTranscript}
    
    Please provide a comprehensive summary of the video's content, focusing on the main points, key ideas, and important details discussed in the transcript. Ensure the summary accurately reflects the video's content rather than just the metadata. Aim for a summary of about 300-500 words.`

    // Add retries for API calls
    let attempts = 0
    const maxAttempts = 3
    let lastError: Error | null = null

    while (attempts < maxAttempts) {
      try {
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()
        return text
      } catch (error) {
        lastError = error as Error
        attempts++
        if (attempts < maxAttempts) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000))
        }
      }
    }

    throw new Error(`Failed to generate summary after ${maxAttempts} attempts. ${lastError?.message || ''}`)
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

