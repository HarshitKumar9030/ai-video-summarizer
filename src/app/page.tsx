import VideoSummarizer from '@/components/video-summarizer'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-4xl font-bold text-center mb-4">YouTube Video Summarizer</h1>
      <p className="text-center mb-8 text-gray-600">
        Get concise and comprehensive summaries of YouTube videos based on their content.
      </p>
      <VideoSummarizer />
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>This tool uses AI to generate short summaries, long summaries, and key points based on video transcripts. Results may vary depending on transcript availability and quality.</p>
        <p className='text-sm mt-8 '>Made with love by <Link className='font-bold' href={"https://leoncyriac.me"}>LeonCyriac</Link>.</p>
      </footer>
    </main>
  )
}

