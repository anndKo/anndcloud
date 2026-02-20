/**
 * Client-side thumbnail generation for images and videos.
 * - Videos: captures frame at 2s, resizes to max 720px wide, outputs WebP
 * - Images: resizes to max 720px wide, outputs WebP
 */

const MAX_WIDTH = 720;
const WEBP_QUALITY = 0.82;
const VIDEO_CAPTURE_TIME = 2;

export async function generateVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.addEventListener('loadeddata', () => {
      // Seek to 2s or 10% of duration if shorter
      const seekTime = Math.min(VIDEO_CAPTURE_TIME, video.duration * 0.1);
      video.currentTime = seekTime;
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        const { videoWidth, videoHeight } = video;

        // Scale down to max 720px wide
        let width = videoWidth;
        let height = videoHeight;
        if (width > MAX_WIDTH) {
          height = Math.round((MAX_WIDTH / width) * height);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            resolve(blob);
          },
          'image/webp',
          WEBP_QUALITY
        );
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    });

    video.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      resolve(null);
    });

    // Timeout after 15s
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 15000);
  });
}

export async function generateImageThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    img.addEventListener('load', () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > MAX_WIDTH) {
          height = Math.round((MAX_WIDTH / width) * height);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            resolve(blob);
          },
          'image/webp',
          WEBP_QUALITY
        );
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    });

    img.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      resolve(null);
    });
  });
}

export async function generateThumbnail(file: File): Promise<Blob | null> {
  if (file.type.startsWith('video/')) {
    return generateVideoThumbnail(file);
  }
  if (file.type.startsWith('image/')) {
    return generateImageThumbnail(file);
  }
  return null;
}
