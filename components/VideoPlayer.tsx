interface VideoPlayerProps {
  shareId: string
}

export default function VideoPlayer({ shareId }: VideoPlayerProps) {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-surface-700">
      <iframe
        src={`${workerUrl}/player?id=${shareId}`}
        className="w-full h-full"
        allowFullScreen
        allow="autoplay; fullscreen"
      />
    </div>
  )
}
