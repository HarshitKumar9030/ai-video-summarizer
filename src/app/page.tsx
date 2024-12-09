import VideoSummarizer from '@/components/video-summarizer'

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-4xl font-bold text-center mb-8">AI Video Summarizer</h1>
      <VideoSummarizer />
    </main>
  )
}

