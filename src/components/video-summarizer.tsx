'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, AlertTriangle, Info } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { summarizeVideo } from '@/app/actions'

const formSchema = z.object({
  videoUrl: z.string().url('Please enter a valid URL').refine(
    (url) => url.includes('youtube.com') || url.includes('youtu.be'),
    'Must be a YouTube URL'
  ),
})

interface SummaryResult {
  shortSummary: string;
  longSummary: string;
  keyPoints: string[];
}

export default function VideoSummarizer() {
  const [summary, setSummary] = useState<SummaryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [retryCount, setRetryCount] = useState(0)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      videoUrl: '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    setError(null)
    setSummary(null)
    setProgress(0)
    setRetryCount(0)

    try {
      const progressInterval = setInterval(() => {
        setProgress((prevProgress) => {
          if (prevProgress >= 90) {
            clearInterval(progressInterval)
            return prevProgress
          }
          return prevProgress + 10
        })
      }, 1000)

      const result = await summarizeVideo(values.videoUrl)
      setSummary(result)
      setProgress(100)
      clearInterval(progressInterval)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.'
      setError(errorMessage)
      
      if (errorMessage.includes('API quota') || errorMessage.includes('try again')) {
        setRetryCount((prev) => prev + 1)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="videoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>YouTube Video URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter the URL of the YouTube video you want to summarize.
                    The video must have captions available for the best results.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {retryCount > 0 ? 'Retry Summarization' : 'Summarize Video'}
            </Button>
          </form>
        </Form>

        {isLoading && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-500">
              {progress < 30 ? 'Fetching video information...' :
               progress < 60 ? 'Extracting video transcript...' :
               progress < 90 ? 'Generating summaries...' : 
               'Finalizing results...'}
            </p>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="mt-2">
              {error}
              {error.includes('API quota') && (
                <p className="mt-2 text-sm">
                  This might be due to high usage. Please try again in a few minutes.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {summary && (
          <div className="mt-6">
            <Tabs defaultValue="short">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="short">Short Summary</TabsTrigger>
                <TabsTrigger value="long">Long Summary</TabsTrigger>
                <TabsTrigger value="key">Key Points</TabsTrigger>
              </TabsList>
              <TabsContent value="short">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Short Summary</AlertTitle>
                  <AlertDescription className="mt-2 whitespace-pre-line">
                    {summary.shortSummary}
                  </AlertDescription>
                </Alert>
              </TabsContent>
              <TabsContent value="long">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Long Summary</AlertTitle>
                  <AlertDescription className="mt-2 whitespace-pre-line">
                    {summary.longSummary}
                  </AlertDescription>
                </Alert>
              </TabsContent>
              <TabsContent value="key">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Key Points</AlertTitle>
                  <AlertDescription className="mt-2">
                    <ul className="list-disc pl-5 space-y-1">
                      {summary.keyPoints.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>
            <p className="mt-4 text-sm text-gray-500">
              These summaries are generated based on the video&apos;s transcript and may not capture all nuances of the video content.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

