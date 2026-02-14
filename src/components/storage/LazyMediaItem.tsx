import { memo, useRef, useState, useCallback, useEffect } from 'react';
import { Play, CheckSquare, Square, Film, ImageIcon } from 'lucide-react';
import { useIntersectionUrl } from '@/hooks/use-url-cache';
import { fetchAndCacheUrl } from '@/hooks/use-url-cache';

interface MediaItem {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  mime_type: string | null;
  category: string;
  created_at: string;
  thumbnail_url?: string | null;
}

interface LazyMediaItemProps {
  item: MediaItem;
  selectionMode?: boolean;
  isSelected?: boolean;
  onClick: () => void;
  isDownloading?: boolean;
  downloadProgress?: number;
  onCancelDownload?: () => void;
}

// Global cache for generated video frame data URLs
const videoFrameCache = new Map<string, string>();

function useVideoFrame(filePath: string | undefined, isVideo: boolean, hasThumbnail: boolean, ref: React.RefObject<Element>) {
  const [frameUrl, setFrameUrl] = useState<string | null>(() =>
    filePath ? videoFrameCache.get(filePath) || null : null
  );
  const triggered = useRef(false);

  useEffect(() => {
    if (!filePath || !isVideo || hasThumbnail || triggered.current || !ref.current) return;

    const cached = videoFrameCache.get(filePath);
    if (cached) { setFrameUrl(cached); return; }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !triggered.current) {
          triggered.current = true;
          observer.disconnect();

          // Get signed URL then extract frame
          fetchAndCacheUrl(filePath).then(signedUrl => {
            if (!signedUrl) return;
            extractVideoFrame(signedUrl).then(dataUrl => {
              if (dataUrl) {
                videoFrameCache.set(filePath, dataUrl);
                setFrameUrl(dataUrl);
              }
            });
          });
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [filePath, isVideo, hasThumbnail, ref]);

  return frameUrl;
}

function extractVideoFrame(videoUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.addEventListener('loadeddata', () => {
      const seekTime = Math.min(2, video.duration * 0.1);
      video.currentTime = seekTime;
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        // Use square crop for consistent grid display
        const size = Math.min(video.videoWidth, video.videoHeight, 360);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { cleanup(); resolve(null); return; }

        // Center-crop to square
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;
        ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

        const dataUrl = canvas.toDataURL('image/webp', 0.6);
        cleanup();
        resolve(dataUrl);
      } catch {
        cleanup();
        resolve(null);
      }
    });

    video.addEventListener('error', () => { cleanup(); resolve(null); });
    setTimeout(() => { cleanup(); resolve(null); }, 10000);
  });
}

export const LazyMediaItem = memo(function LazyMediaItem({
  item,
  selectionMode,
  isSelected,
  onClick,
  isDownloading,
  downloadProgress,
  onCancelDownload
}: LazyMediaItemProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasThumbnail = !!item.thumbnail_url;
  const isVideo = item.mime_type?.startsWith('video/');

  // For images without thumbnail: use intersection-based signed URL
  const { url: signedUrl, thumbUrl, loading } = useIntersectionUrl(
    !isVideo && !hasThumbnail ? item.file_path : undefined,
    containerRef
  );

  // For videos without thumbnail: extract frame on-the-fly
  const videoFrame = useVideoFrame(
    item.file_path,
    !!isVideo,
    hasThumbnail,
    containerRef as React.RefObject<Element>
  );

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Determine display URL
  const displayUrl = hasThumbnail
    ? item.thumbnail_url!
    : isVideo
      ? videoFrame
      : signedUrl;

  const placeholderUrl = hasThumbnail ? item.thumbnail_url! : isVideo ? null : thumbUrl;

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`media-grid-item relative aspect-square bg-muted rounded-lg overflow-hidden group cursor-pointer transition-transform duration-150 active:scale-95 ${
        selectionMode && isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <div className="absolute top-1 left-1 z-10">
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-primary bg-white rounded" />
          ) : (
            <Square className="w-5 h-5 text-white/70 bg-black/30 rounded" />
          )}
        </div>
      )}

      {/* Thumbnail content */}
      {imageError ? (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          {isVideo ? (
            <Film className="w-8 h-8 text-muted-foreground/50" />
          ) : (
            <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
          )}
        </div>
      ) : !displayUrl && !placeholderUrl ? (
        <div className="w-full h-full skeleton-shimmer" />
      ) : (
        <>
          {/* Blur-up placeholder for images */}
          {placeholderUrl && !imageLoaded && (
            <img
              src={placeholderUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-lg scale-110"
              aria-hidden="true"
            />
          )}
          {!imageLoaded && !placeholderUrl && !displayUrl && (
            <div className="absolute inset-0 skeleton-shimmer" />
          )}
          {displayUrl && (
            <img
              src={displayUrl}
              alt=""
              className={`w-full h-full object-cover ${
                isVideo || imageLoaded ? 'thumbnail-reveal' : 'opacity-0'
              }`}
              loading="lazy"
              decoding="async"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          )}
        </>
      )}

      {/* Video indicator */}
      {isVideo && !isDownloading && !selectionMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Download progress overlay */}
      {isDownloading && (
        <div 
          className="absolute inset-0 bg-black/60 flex items-center justify-center z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-3 border-white/30 border-t-white animate-spin mb-2 mx-auto" />
            <span className="text-white font-bold text-lg">{downloadProgress}%</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancelDownload?.();
              }}
              className="mt-2 px-3 py-1 text-white hover:bg-white/20 rounded-md text-sm flex items-center gap-1 mx-auto"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
