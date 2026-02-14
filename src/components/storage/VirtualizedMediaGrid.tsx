import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, MoreVertical, Download, Edit3, Trash2, Check, X, Maximize, Volume2, VolumeX, Share2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LazyMediaItem } from './LazyMediaItem';
import { fetchAndCacheUrl, getCachedUrl } from '@/hooks/use-url-cache';
import { renameFile, deleteFile, formatFileSize } from '@/lib/storage';
import { createShareCode } from '@/lib/share';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

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

interface VirtualizedMediaGridProps {
  items: MediaItem[];
  onUpdate: () => void;
  selectionMode?: boolean;
  selectedItems?: Set<string>;
  onSelectionChange?: (id: string) => void;
}

export const VirtualizedMediaGrid = memo(function VirtualizedMediaGrid({ 
  items, 
  onUpdate, 
  selectionMode, 
  selectedItems, 
  onSelectionChange 
}: VirtualizedMediaGridProps) {
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isDeleting, setIsDeleting] = useState<MediaItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState<{ id: string; progress: number } | null>(null);
  const [downloadXhr, setDownloadXhr] = useState<XMLHttpRequest | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState<MediaItem | null>(null);
  const [shareMaxViews, setShareMaxViews] = useState<string>('');
  const [shareExpiryValue, setShareExpiryValue] = useState<string>('');
  const [shareExpiryUnit, setShareExpiryUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [allowDownload, setAllowDownload] = useState(true);
  const [showInfoDialog, setShowInfoDialog] = useState<MediaItem | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleView = useCallback(async (item: MediaItem) => {
    if (selectionMode) {
      onSelectionChange?.(item.id);
      return;
    }
    
    try {
      const url = await fetchAndCacheUrl(item.file_path);
      if (url) {
        setMediaUrl(url);
        setSelectedItem(item);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tải media.',
      });
    }
  }, [selectionMode, onSelectionChange, toast]);

  const handleDownload = useCallback(async (item: MediaItem) => {
    try {
      const url = await fetchAndCacheUrl(item.file_path);
      if (!url) throw new Error('No URL');

      setDownloadProgress({ id: item.id, progress: 0 });

      const xhr = new XMLHttpRequest();
      xhr.responseType = 'blob';
      setDownloadXhr(xhr);
      
      xhr.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setDownloadProgress({ id: item.id, progress });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const blob = xhr.response;
          const downloadUrl = window.URL.createObjectURL(blob);
          
          const downloadLink = document.createElement('a');
          downloadLink.href = downloadUrl;
          downloadLink.download = item.name;
          downloadLink.style.display = 'none';
          document.body.appendChild(downloadLink);
          downloadLink.click();
          
          setTimeout(() => {
            document.body.removeChild(downloadLink);
            window.URL.revokeObjectURL(downloadUrl);
          }, 100);

          toast({
            title: 'Đã tải xuống',
            description: `${item.name} (${formatFileSize(item.file_size)})`,
            duration: 3000,
          });
        }
        setDownloadProgress(null);
        setDownloadXhr(null);
      });

      xhr.addEventListener('error', () => {
        toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể tải file.' });
        setDownloadProgress(null);
        setDownloadXhr(null);
      });

      xhr.addEventListener('abort', () => {
        toast({ title: 'Đã hủy', description: 'Đã hủy tải xuống.', duration: 2000 });
        setDownloadProgress(null);
        setDownloadXhr(null);
      });

      xhr.open('GET', url);
      xhr.send();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể tải file.' });
      setDownloadProgress(null);
      setDownloadXhr(null);
    }
  }, [toast]);

  const handleCancelDownload = useCallback(() => {
    if (downloadXhr) downloadXhr.abort();
  }, [downloadXhr]);

  const handleRename = useCallback(async (item: MediaItem) => {
    if (!newName.trim()) return;
    try {
      await renameFile(item.id, newName);
      setIsRenaming(null);
      onUpdate();
      toast({ title: 'Đã đổi tên', description: `Đã đổi thành "${newName}"` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể đổi tên.' });
    }
  }, [newName, onUpdate, toast]);

  const handleDelete = useCallback(async () => {
    if (!isDeleting) return;
    try {
      await deleteFile(isDeleting.id, isDeleting.file_path);
      setIsDeleting(null);
      onUpdate();
      toast({ title: 'Đã xóa', description: `Đã xóa "${isDeleting.name}"` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể xóa.' });
    }
  }, [isDeleting, onUpdate, toast]);

  const handleShare = useCallback(async (item: MediaItem) => {
    if (!user) return;
    setShowShareDialog(item);
    setShareMaxViews('');
    setShareExpiryValue('');
    setShareExpiryUnit('hours');
    setIsPrivateMode(false);
    setAllowDownload(true);
  }, [user]);

  const handleConfirmShare = useCallback(async () => {
    if (!user || !showShareDialog) return;
    
    if (isPrivateMode) {
      setIsGeneratingShare(showShareDialog.id);
      try {
        const { error } = await createShareCode(user.id, showShareDialog.id, 'file', null, null, true);
        if (error) throw error;
        toast({ title: 'Chế độ riêng tư', description: 'Đã thu hồi mã chia sẻ.' });
        setShowShareDialog(null);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể thiết lập chế độ riêng tư.' });
      } finally {
        setIsGeneratingShare(null);
      }
      return;
    }
    
    const maxViews = shareMaxViews.trim() ? parseInt(shareMaxViews) : null;
    if (shareMaxViews.trim() && (isNaN(maxViews!) || maxViews! < 1)) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Số lượt xem phải là số nguyên dương.' });
      return;
    }
    
    let expiresInMinutes: number | null = null;
    if (shareExpiryValue.trim()) {
      const expiryNum = parseInt(shareExpiryValue);
      if (isNaN(expiryNum) || expiryNum < 1) {
        toast({ variant: 'destructive', title: 'Lỗi', description: 'Thời hạn phải là số nguyên dương.' });
        return;
      }
      switch (shareExpiryUnit) {
        case 'minutes': expiresInMinutes = expiryNum; break;
        case 'hours': expiresInMinutes = expiryNum * 60; break;
        case 'days': expiresInMinutes = expiryNum * 60 * 24; break;
      }
    }
    
    setIsGeneratingShare(showShareDialog.id);
    try {
      const { code, error } = await createShareCode(user.id, showShareDialog.id, 'file', maxViews, expiresInMinutes, false, allowDownload);
      if (error) throw error;
      if (code) {
        await navigator.clipboard.writeText(code);
        toast({ title: 'Đã sao chép mã chia sẻ', description: `Mã: ${code}` });
      }
      setShowShareDialog(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể tạo mã chia sẻ.' });
    } finally {
      setIsGeneratingShare(null);
    }
  }, [user, showShareDialog, isPrivateMode, shareMaxViews, shareExpiryValue, shareExpiryUnit, allowDownload, toast]);

  const isVideo = (item: MediaItem) => item.mime_type?.startsWith('video/');

  const handleSeek = (value: number[]) => {
    if (videoRef.current && duration > 0) {
      const newTime = (value[0] / 100) * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play();
      else videoRef.current.pause();
    }
  }, []);

  return (
    <>
      {/* Optimized Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1 sm:gap-2">
        {items.map((item) => (
          <LazyMediaItem
            key={item.id}
            item={item}
            selectionMode={selectionMode}
            isSelected={selectedItems?.has(item.id)}
            onClick={() => handleView(item)}
            isDownloading={downloadProgress?.id === item.id}
            downloadProgress={downloadProgress?.progress}
            onCancelDownload={handleCancelDownload}
          />
        ))}
      </div>

      {/* Fullscreen preview dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 overflow-hidden bg-black/95">
          {selectedItem && mediaUrl && (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* 3-dot menu in top left */}
              <div className="absolute top-4 left-4 z-50">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full bg-black/30">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[180px]">
                    <DropdownMenuItem onClick={() => setShowInfoDialog(selectedItem)}>
                      <Info className="w-4 h-4 mr-2" />
                      Thông tin chi tiết
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleShare(selectedItem)}>
                      <Share2 className="w-4 h-4 mr-2" />
                      Mã chia sẻ
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownload(selectedItem)}>
                      <Download className="w-4 h-4 mr-2" />
                      Tải xuống
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      setNewName(selectedItem.name);
                      setIsRenaming(selectedItem.id);
                    }}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Đổi tên
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setIsDeleting(selectedItem)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Xóa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 text-white hover:bg-white/20 z-50"
              >
                <X className="w-6 h-6" />
              </Button>

              {/* Media content */}
              {isVideo(selectedItem) ? (
                <div className="w-full h-full flex flex-col">
                  <div
                    className="flex-1 flex items-center justify-center min-h-0 cursor-pointer relative"
                    onClick={togglePlayPause}
                  >
                    <video
                      ref={videoRef}
                      src={mediaUrl}
                      className="max-w-full max-h-full object-contain"
                      playsInline
                      autoPlay
                      preload="auto"
                      onLoadedMetadata={(e) => {
                        const video = e.target as HTMLVideoElement;
                        setDuration(video.duration);
                      }}
                      onTimeUpdate={(e) => {
                        const video = e.target as HTMLVideoElement;
                        setCurrentTime(video.currentTime);
                      }}
                      onProgress={(e) => {
                        const video = e.target as HTMLVideoElement;
                        if (video.buffered.length > 0 && video.duration > 0) {
                          const buffered = video.buffered.end(video.buffered.length - 1);
                          setBufferedPercent(Math.round((buffered / video.duration) * 100));
                        }
                      }}
                      onWaiting={() => setIsBuffering(true)}
                      onCanPlay={() => setIsBuffering(false)}
                      onPlaying={() => setIsBuffering(false)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      muted={isMuted}
                    />
                    {/* Buffering spinner */}
                    {isBuffering && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative w-16 h-16">
                          <svg className="w-16 h-16 animate-spin" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="4" />
                            <circle cx="32" cy="32" r="28" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round"
                              strokeDasharray={`${bufferedPercent * 1.76} 176`} 
                              transform="rotate(-90 32 32)"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">
                            {bufferedPercent}%
                          </span>
                        </div>
                      </div>
                    )}
                    {!isPlaying && !isBuffering && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm">
                          <Play className="w-8 h-8 text-white fill-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Video controls - mobile optimized */}
                  <div className="px-3 py-2 sm:px-4 sm:py-4 bg-black/80 backdrop-blur-sm">
                    {/* Progress bar - full width, larger on mobile */}
                    <div className="mb-2 sm:mb-3">
                      <Slider
                        value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
                        max={100}
                        step={0.1}
                        onValueChange={handleSeek}
                        className="cursor-pointer video-progress-slider"
                      />
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <Button variant="ghost" size="icon" onClick={togglePlayPause} className="text-white h-8 w-8 sm:h-10 sm:w-10">
                        {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6" />}
                      </Button>
                      <span className="text-white text-xs sm:text-sm min-w-[40px] sm:min-w-[60px]">{formatTime(currentTime)}</span>
                      <div className="flex-1" />
                      <span className="text-white text-xs sm:text-sm min-w-[40px] sm:min-w-[60px] text-right">{formatTime(duration)}</span>
                      <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)} className="text-white h-8 w-8 sm:h-10 sm:w-10">
                        {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => videoRef.current?.requestFullscreen()} className="text-white h-8 w-8 sm:h-10 sm:w-10">
                        <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={mediaUrl}
                  alt={selectedItem.name}
                  className="max-w-full max-h-full object-contain thumbnail-reveal"
                  loading="eager"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!isRenaming} onOpenChange={(open) => !open && setIsRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên mới"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsRenaming(null)}>Hủy</Button>
              <Button onClick={() => {
                const item = items.find(i => i.id === isRenaming);
                if (item) handleRename(item);
              }}>Lưu</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!isDeleting} onOpenChange={(open) => !open && setIsDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa "{isDeleting?.name}"? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share dialog */}
      <Dialog open={!!showShareDialog} onOpenChange={(open) => !open && setShowShareDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cài đặt chia sẻ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Chế độ</Label>
              <RadioGroup
                value={isPrivateMode ? 'private' : 'public'}
                onValueChange={(v) => setIsPrivateMode(v === 'private')}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="public" id="public" />
                  <Label htmlFor="public">Chia sẻ công khai</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="private" id="private" />
                  <Label htmlFor="private">Chế độ riêng tư (thu hồi mã)</Label>
                </div>
              </RadioGroup>
            </div>

            {!isPrivateMode && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Cho phép tải xuống</Label>
                  <RadioGroup
                    value={allowDownload ? 'yes' : 'no'}
                    onValueChange={(v) => setAllowDownload(v === 'yes')}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="download-yes" />
                      <Label htmlFor="download-yes">Có</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="download-no" />
                      <Label htmlFor="download-no">Không (chỉ xem)</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Giới hạn lượt xem (tùy chọn)</Label>
                  <Input type="number" min="1" value={shareMaxViews} onChange={(e) => setShareMaxViews(e.target.value)} placeholder="Không giới hạn" />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Thời hạn (tùy chọn)</Label>
                  <div className="flex gap-2">
                    <Input type="number" min="1" value={shareExpiryValue} onChange={(e) => setShareExpiryValue(e.target.value)} placeholder="Không giới hạn" className="flex-1" />
                    <select value={shareExpiryUnit} onChange={(e) => setShareExpiryUnit(e.target.value as any)} className="px-3 py-2 border rounded-md bg-background">
                      <option value="minutes">Phút</option>
                      <option value="hours">Giờ</option>
                      <option value="days">Ngày</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <Button onClick={handleConfirmShare} className="w-full" disabled={isGeneratingShare === showShareDialog?.id}>
              {isGeneratingShare ? 'Đang xử lý...' : isPrivateMode ? 'Thu hồi mã' : 'Tạo mã chia sẻ'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info dialog */}
      <Dialog open={!!showInfoDialog} onOpenChange={(open) => !open && setShowInfoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thông tin chi tiết</DialogTitle>
          </DialogHeader>
          {showInfoDialog && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tên:</span>
                <span className="font-medium truncate ml-2 max-w-[200px]">{showInfoDialog.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loại:</span>
                <span>{showInfoDialog.mime_type || showInfoDialog.file_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kích thước:</span>
                <span>{formatFileSize(showInfoDialog.file_size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ngày tạo:</span>
                <span>{format(new Date(showInfoDialog.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});
