import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Video, X, RotateCcw, StopCircle, Loader2, ZoomIn, ZoomOut, Settings, Flashlight, FlashlightOff, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Resolution = '720p' | '1080p' | '2k';

const RESOLUTIONS: Record<Resolution, { width: number; height: number; label: string }> = {
  '720p': { width: 1280, height: 720, label: '720p HD' },
  '1080p': { width: 1920, height: 1080, label: '1080p Full HD' },
  '2k': { width: 2560, height: 1440, label: '2K QHD' },
};

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
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
  const [resolution, setResolution] = useState<Resolution>('1080p');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [supportsTorch, setSupportsTorch] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const res = RESOLUTIONS[resolution];
      
      // For video mode, use lower frame rate to prevent lag while recording
      const targetFrameRate = mode === 'video' ? 30 : 60;
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: res.width, min: 640 },
          height: { ideal: res.height, min: 480 },
          frameRate: { ideal: targetFrameRate, min: 24 },
          aspectRatio: { ideal: 16 / 9 },
        },
        audio: false, // Don't request audio in preview stream
      });

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        // Ensure smooth playback
        videoRef.current.play().catch(console.error);
      }

      // Check zoom and torch capabilities
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
        
        // Check torch (flash) support
        if (capabilities?.torch) {
          setSupportsTorch(true);
        } else {
          setSupportsTorch(false);
        }
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setCameraError(error.message || 'Không thể truy cập camera. Vui lòng cấp quyền.');
    }
  }, [facingMode, mode, resolution]);

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

  // Format time for display (HH:MM:SS)
  const formatRecordingTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Apply zoom when it changes
  useEffect(() => {
    if (!stream || !supportsZoom) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        videoTrack.applyConstraints({
          // @ts-ignore - zoom may not be in types
          advanced: [{ zoom }]
        });
      } catch (err) {
        console.log('Could not apply zoom:', err);
      }
    }
  }, [zoom, stream, supportsZoom]);

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setZoom(minZoom);
    setFlashOn(false); // Turn off flash when switching camera
  };

  // Toggle flash/torch
  const toggleFlash = async () => {
    if (!stream || !supportsTorch) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    try {
      await videoTrack.applyConstraints({
        // @ts-ignore - torch may not be in types
        advanced: [{ torch: !flashOn }]
      });
      setFlashOn(!flashOn);
    } catch (err) {
      console.log('Could not toggle torch:', err);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể bật/tắt đèn flash.',
      });
    }
  };

  // Tap to focus
  const handleTapToFocus = async (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current || !stream) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const capabilities = videoTrack.getCapabilities?.() as any;
    if (!capabilities) return;

    // Check if focus mode is supported
    if (capabilities.focusMode) {
      try {
        await videoTrack.applyConstraints({
          // @ts-ignore - focusMode may not be in types
          advanced: [{ focusMode: 'manual' }]
        });
        // Trigger refocus
        setTimeout(async () => {
          await videoTrack.applyConstraints({
            // @ts-ignore
            advanced: [{ focusMode: 'continuous' }]
          });
        }, 500);
      } catch (err) {
        console.log('Focus not supported on this device');
      }
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.5, maxZoom));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.5, minZoom));
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isSaving) return;

    setIsSaving(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Use full resolution from video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) {
      setIsSaving(false);
      return;
    }

    // High quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Flip image for front camera to match real-world orientation
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

    try {
      chunksRef.current = [];
      
      // Get audio stream separately with optimized settings
      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100, // Standard sample rate
            channelCount: 1, // Mono for better performance
          },
        });
      } catch (audioErr) {
        console.log('Audio not available, recording without audio');
      }

      // Clone video tracks to avoid interfering with preview
      const videoTracks = stream.getVideoTracks();
      const clonedVideoTracks = videoTracks.map(track => track.clone());
      const tracks: MediaStreamTrack[] = [...clonedVideoTracks];
      
      if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
      }

      const combinedStream = new MediaStream(tracks);
      
      // Use VP8 for best performance - VP9 causes lag on many devices
      const codecs = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      
      const mimeType = codecs.find(c => MediaRecorder.isTypeSupported(c)) || 'video/webm';

      // Optimized bitrate for smooth recording without lag
      // Lower bitrate = less processing = smoother camera movement
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps - optimized for smooth recording
        audioBitsPerSecond: 96000, // Lower audio bitrate for better performance
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop cloned video tracks and audio tracks
        clonedVideoTracks.forEach(track => track.stop());
        audioStream?.getTracks().forEach(track => track.stop());
        
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        const isWebM = mimeType.includes('webm');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = isWebM ? 'webm' : 'mp4';
        const file = new File([blob], `video-${Date.now()}.${ext}`, { type: blob.type });
        onCapture(file);
        
        setRecordingTime(0);
        setRecordingStartTime(null);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // 1 second chunks - better for performance
      
      const startTime = Date.now();
      setRecordingStartTime(startTime);
      setRecordingTime(0);
      
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingTime(elapsed);
      }, 1000);
      
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast?.({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể bắt đầu quay video.',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full w-12 h-12"
          >
            <X className="w-6 h-6" />
          </Button>
          
          {/* Flash button */}
          {supportsTorch && facingMode === 'environment' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFlash}
              className={`rounded-full w-12 h-12 ${flashOn ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'text-white hover:bg-white/20'}`}
            >
              {flashOn ? <Flashlight className="w-6 h-6" /> : <FlashlightOff className="w-6 h-6" />}
            </Button>
          )}
        </div>

        <div className="flex gap-2 bg-black/50 rounded-full p-1">
          <button
            onClick={() => setMode('photo')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              mode === 'photo' ? 'bg-white text-black' : 'text-white'
            }`}
          >
            <Camera className="w-4 h-4 inline mr-1" />
            Ảnh
          </button>
          <button
            onClick={() => setMode('video')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              mode === 'video' ? 'bg-white text-black' : 'text-white'
            }`}
          >
            <Video className="w-4 h-4 inline mr-1" />
            Video
          </button>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 rounded-full w-12 h-12"
              >
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
          <Button
            variant="ghost"
            size="icon"
            onClick={switchCamera}
            className="text-white hover:bg-white/20 rounded-full w-12 h-12"
          >
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
            <Button
              onClick={startCamera}
              className="mt-4 bg-white/20 hover:bg-white/30"
            >
              Thử lại
            </Button>
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

        {/* Recording timer - centered below mode switch */}
        {isRecording && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white font-mono text-sm font-medium">
              {formatRecordingTime(recordingTime)}
            </span>
          </div>
        )}

        {/* Saving indicator */}
        {isSaving && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-primary/80 px-4 py-2 rounded-full">
            <Loader2 className="w-4 h-4 text-white animate-spin" />
            <span className="text-white font-medium">Đang lưu...</span>
          </div>
        )}

        {/* Zoom indicator */}
        {supportsZoom && zoom > minZoom && (
          <div className="absolute top-20 right-4 bg-black/50 px-3 py-1 rounded-full">
            <span className="text-white text-sm font-medium">{zoom.toFixed(1)}x</span>
          </div>
        )}

        {/* Zoom controls - right side */}
        {supportsZoom && maxZoom > minZoom && !cameraError && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= maxZoom}
              className="text-white hover:bg-white/20 rounded-full w-10 h-10 bg-black/30"
            >
              <ZoomIn className="w-5 h-5" />
            </Button>
            
            <div className="h-32 flex items-center">
              <Slider
                orientation="vertical"
                value={[zoom]}
                min={minZoom}
                max={maxZoom}
                step={0.1}
                onValueChange={([value]) => setZoom(value)}
                className="h-full"
              />
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= minZoom}
              className="text-white hover:bg-white/20 rounded-full w-10 h-10 bg-black/30"
            >
              <ZoomOut className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Resolution indicator */}
        {!cameraError && (
          <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full">
            <span className="text-white text-sm font-medium">{RESOLUTIONS[resolution].label}</span>
          </div>
        )}
      </div>

      {/* Controls - Centered */}
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
            className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-95 ${
              isRecording ? 'bg-red-500' : 'bg-transparent'
            }`}
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
