import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Video, X, RotateCcw, StopCircle, Loader2, ZoomIn, ZoomOut, Settings, Flashlight, FlashlightOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Resolution = '1080p' | '2k' | '4k';

const RESOLUTIONS: Record<Resolution, { width: number; height: number; label: string }> = {
  '1080p': { width: 1920, height: 1080, label: '1080p Full HD' },
  '2k': { width: 2560, height: 1440, label: '2K QHD' },
  '4k': { width: 3840, height: 2160, label: '4K Ultra HD' },
};

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

interface FocusIndicator {
  x: number;
  y: number;
  id: number;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isSaving, setIsSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [supportsZoom, setSupportsZoom] = useState(false);
  const [resolution, setResolution] = useState<Resolution>('4k');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [supportsTorch, setSupportsTorch] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [focusIndicators, setFocusIndicators] = useState<FocusIndicator[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusIdRef = useRef(0);
  
  const { toast } = useToast();

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // Try resolutions from highest to lowest
      const resOrder: Resolution[] = resolution === '4k' ? ['4k', '2k', '1080p'] :
                                      resolution === '2k' ? ['2k', '1080p'] : ['1080p'];
      
      let newStream: MediaStream | null = null;
      let usedRes: Resolution = '1080p';
      
      for (const res of resOrder) {
        try {
          const r = RESOLUTIONS[res];
          newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode,
              width: { ideal: r.width, min: 640 },
              height: { ideal: r.height, min: 480 },
              frameRate: { ideal: 60, min: 30 },
              aspectRatio: { ideal: 16 / 9 },
            },
            audio: false,
          });
          usedRes = res;
          break;
        } catch {
          continue;
        }
      }
      
      if (!newStream) throw new Error('Không thể mở camera');

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch(console.error);
      }

      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities?.() as any;
        if (capabilities?.zoom) {
          setSupportsZoom(true);
          setMinZoom(capabilities.zoom.min || 1);
          setMaxZoom(capabilities.zoom.max || 1);
          setZoom(capabilities.zoom.min || 1);
        } else {
          setSupportsZoom(false);
        }
        setSupportsTorch(!!capabilities?.torch);
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setCameraError(error.message || 'Không thể truy cập camera.');
    }
  }, [facingMode, resolution]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [startCamera]);

  const formatRecordingTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Apply zoom
  useEffect(() => {
    if (!stream || !supportsZoom) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        videoTrack.applyConstraints({ advanced: [{ zoom } as any] });
      } catch {}
    }
  }, [zoom, stream, supportsZoom]);

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setZoom(minZoom);
    setFlashOn(false);
  };

  const toggleFlash = async () => {
    if (!stream || !supportsTorch) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    try {
      await videoTrack.applyConstraints({ advanced: [{ torch: !flashOn } as any] });
      setFlashOn(!flashOn);
    } catch {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể bật/tắt đèn flash.' });
    }
  };

  // Tap to focus with visual indicator
  const handleTapToFocus = async (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current || !stream) return;
    
    const rect = videoRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Show focus indicator
    const id = ++focusIdRef.current;
    setFocusIndicators(prev => [...prev, { x, y, id }]);
    setTimeout(() => {
      setFocusIndicators(prev => prev.filter(f => f.id !== id));
    }, 900);

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    const capabilities = videoTrack.getCapabilities?.() as any;
    if (capabilities?.focusMode) {
      try {
        // Calculate focus point (normalized 0-1)
        const pointX = (e.clientX - rect.left) / rect.width;
        const pointY = (e.clientY - rect.top) / rect.height;
        
        await videoTrack.applyConstraints({
          advanced: [{ 
            focusMode: 'manual',
            ...(capabilities.pointsOfInterest ? { pointsOfInterest: [{ x: pointX, y: pointY }] } : {})
          } as any]
        });
        setTimeout(async () => {
          try {
            await videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
          } catch {}
        }, 500);
      } catch {}
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, maxZoom));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, minZoom));

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isSaving) return;
    setIsSaving(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) { setIsSaving(false); return; }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
      }
      setIsSaving(false);
    }, 'image/jpeg', 1.0);
  };

  const startRecording = async () => {
    if (!stream) return;
    setIsRecording(true);
    const startTime = Date.now();
    setRecordingTime(0);
    
    try {
      chunksRef.current = [];
      
      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 44100, channelCount: 1 },
        });
      } catch {}

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('No video track');
      
      const tracks: MediaStreamTrack[] = [videoTrack];
      if (audioStream) tracks.push(...audioStream.getAudioTracks());
      const combinedStream = new MediaStream(tracks);
      
      // Prefer H264 for quality, fallback to VP8/VP9
      const codecs = [
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      const mimeType = codecs.find(c => MediaRecorder.isTypeSupported(c)) || 'video/webm';

      // High quality bitrate for sharp video
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8_000_000, // 8 Mbps for sharp 4K/1080p
        audioBitsPerSecond: 128_000,
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        audioStream?.getTracks().forEach(track => track.stop());
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
        const file = new File([blob], `video-${Date.now()}.${ext}`, { type: blob.type });
        onCapture(file);
        setRecordingTime(0);
      };

      mediaRecorder.onerror = () => {
        toast({ variant: 'destructive', title: 'Lỗi', description: 'Lỗi quay video.' });
        setIsRecording(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(2000);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể bắt đầu quay video.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try { mediaRecorderRef.current.stop(); } catch {}
      setIsRecording(false);
      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full w-12 h-12">
            <X className="w-6 h-6" />
          </Button>
          {supportsTorch && facingMode === 'environment' && (
            <Button
              variant="ghost" size="icon" onClick={toggleFlash}
              className={`rounded-full w-12 h-12 ${flashOn ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'text-white hover:bg-white/20'}`}
            >
              {flashOn ? <Flashlight className="w-6 h-6" /> : <FlashlightOff className="w-6 h-6" />}
            </Button>
          )}
        </div>

        <div className="flex gap-2 bg-black/50 rounded-full p-1">
          <button
            onClick={() => setMode('photo')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${mode === 'photo' ? 'bg-white text-black' : 'text-white'}`}
          >
            <Camera className="w-4 h-4 inline mr-1" /> Ảnh
          </button>
          <button
            onClick={() => setMode('video')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${mode === 'video' ? 'bg-white text-black' : 'text-white'}`}
          >
            <Video className="w-4 h-4 inline mr-1" /> Video
          </button>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full w-12 h-12">
                <Settings className="w-6 h-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/90 border-white/20">
              {(Object.keys(RESOLUTIONS) as Resolution[]).map((res) => (
                <DropdownMenuItem
                  key={res}
                  onClick={() => setResolution(res)}
                  className={`text-white hover:bg-white/20 ${resolution === res ? 'bg-white/30' : ''}`}
                >
                  {RESOLUTIONS[res].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={switchCamera} className="text-white hover:bg-white/20 rounded-full w-12 h-12">
            <RotateCcw className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Video preview */}
      <div className="flex-1 relative">
        {cameraError ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-white p-4">
            <Camera className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-center text-lg">{cameraError}</p>
            <Button onClick={startCamera} className="mt-4 bg-white/20 hover:bg-white/30">Thử lại</Button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onClick={handleTapToFocus}
            className="w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />
        )}
        
        <canvas ref={canvasRef} className="hidden" />

        {/* Focus indicators */}
        {focusIndicators.map(f => (
          <div
            key={f.id}
            className="focus-ring absolute pointer-events-none"
            style={{
              left: f.x,
              top: f.y,
              width: 72,
              height: 72,
              border: '2px solid rgba(255,255,255,0.9)',
              borderRadius: '50%',
              boxShadow: '0 0 12px rgba(255,255,255,0.3)',
            }}
          />
        ))}

        {/* Recording timer */}
        {isRecording && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white font-mono text-sm font-medium">{formatRecordingTime(recordingTime)}</span>
          </div>
        )}

        {isSaving && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-primary/80 px-4 py-2 rounded-full">
            <Loader2 className="w-4 h-4 text-white animate-spin" />
            <span className="text-white font-medium">Đang lưu...</span>
          </div>
        )}

        {supportsZoom && zoom > minZoom && (
          <div className="absolute top-20 right-4 bg-black/50 px-3 py-1 rounded-full">
            <span className="text-white text-sm font-medium">{zoom.toFixed(1)}x</span>
          </div>
        )}

        {supportsZoom && maxZoom > minZoom && !cameraError && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoom >= maxZoom} className="text-white hover:bg-white/20 rounded-full w-10 h-10 bg-black/30">
              <ZoomIn className="w-5 h-5" />
            </Button>
            <div className="h-32 flex items-center">
              <Slider orientation="vertical" value={[zoom]} min={minZoom} max={maxZoom} step={0.1} onValueChange={([value]) => setZoom(value)} className="h-full" />
            </div>
            <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoom <= minZoom} className="text-white hover:bg-white/20 rounded-full w-10 h-10 bg-black/30">
              <ZoomOut className="w-5 h-5" />
            </Button>
          </div>
        )}

        {!cameraError && (
          <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full">
            <span className="text-white text-sm font-medium">{RESOLUTIONS[resolution].label}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center">
        {mode === 'photo' ? (
          <button
            onClick={capturePhoto}
            disabled={isSaving}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-transparent active:scale-95 transition-transform disabled:opacity-50"
          >
            <div className="w-16 h-16 rounded-full bg-white" />
          </button>
        ) : (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-95 ${isRecording ? 'bg-red-500' : 'bg-transparent'}`}
          >
            {isRecording ? (
              <StopCircle className="w-10 h-10 text-white" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-red-500" />
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}
