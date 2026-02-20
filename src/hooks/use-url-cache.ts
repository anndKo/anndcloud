import { useState, useEffect, useCallback, useRef } from 'react';
import { getSignedUrl } from '@/lib/storage';

// Global URL cache with expiration tracking
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const pendingRequests = new Map<string, Promise<string | null>>();

// Cache duration: 50 minutes (URLs expire in 1 hour, we refresh early)
const CACHE_DURATION = 50 * 60 * 1000;

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  urlCache.forEach((value, key) => {
    if (value.expiresAt < now) {
      urlCache.delete(key);
    }
  });
}, 60000);

function cacheKey(filePath: string, thumb?: boolean) {
  return thumb ? `thumb:${filePath}` : filePath;
}

export function getCachedUrl(filePath: string, thumb?: boolean): string | null {
  const cached = urlCache.get(cacheKey(filePath, thumb));
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  return null;
}

export async function fetchAndCacheUrl(filePath: string, thumb?: boolean): Promise<string | null> {
  const key = cacheKey(filePath, thumb);
  const cached = getCachedUrl(filePath, thumb);
  if (cached) return cached;

  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const transform = thumb ? { width: 20, height: 20, quality: 20 } : undefined;
      const { url } = await getSignedUrl(filePath, transform);
      if (url) {
        urlCache.set(key, { url, expiresAt: Date.now() + CACHE_DURATION });
        return url;
      }
      return null;
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, request);
  return request;
}

// Batch fetch multiple URLs in parallel
export async function batchFetchUrls(filePaths: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const toFetch: string[] = [];

  for (const path of filePaths) {
    const cached = getCachedUrl(path);
    if (cached) {
      results.set(path, cached);
    } else {
      toFetch.push(path);
    }
  }

  const BATCH_SIZE = 10;
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const urls = await Promise.all(batch.map(p => fetchAndCacheUrl(p)));
    batch.forEach((path, idx) => {
      if (urls[idx]) {
        results.set(path, urls[idx]!);
      }
    });
  }

  return results;
}

// Hook for lazy loading a single URL
export function useLazyUrl(filePath: string | undefined) {
  const [url, setUrl] = useState<string | null>(() => 
    filePath ? getCachedUrl(filePath) : null
  );
  const [loading, setLoading] = useState(!url && !!filePath);

  useEffect(() => {
    if (!filePath) {
      setUrl(null);
      setLoading(false);
      return;
    }

    const cached = getCachedUrl(filePath);
    if (cached) {
      setUrl(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchAndCacheUrl(filePath).then(result => {
      setUrl(result);
      setLoading(false);
    });
  }, [filePath]);

  return { url, loading };
}

// Hook for intersection-based lazy loading with blur-up support
export function useIntersectionUrl(
  filePath: string | undefined,
  ref: React.RefObject<Element>
) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(() =>
    filePath ? getCachedUrl(filePath, true) : null
  );
  const [url, setUrl] = useState<string | null>(() => 
    filePath ? getCachedUrl(filePath) : null
  );
  const [loading, setLoading] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!filePath || !ref.current || hasLoaded.current) return;

    // Check full cache first
    const cachedFull = getCachedUrl(filePath);
    if (cachedFull) {
      setUrl(cachedFull);
      setThumbUrl(null);
      hasLoaded.current = true;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasLoaded.current) {
          hasLoaded.current = true;
          setLoading(true);

          // Load thumbnail and full URL in parallel
          const isImage = !filePath.match(/\.(mp4|mov|avi|webm|mkv)$/i);
          
          if (isImage) {
            // Fetch tiny thumb immediately for blur-up
            fetchAndCacheUrl(filePath, true).then(t => {
              if (t) setThumbUrl(t);
            });
          }

          // Fetch full URL
          fetchAndCacheUrl(filePath).then(result => {
            setUrl(result);
            setLoading(false);
          });

          observer.disconnect();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [filePath, ref]);

  return { url, thumbUrl, loading };
}
