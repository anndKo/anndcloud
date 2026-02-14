import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, MoreVertical, Download, Edit3, Trash2, Check, X, Maximize, Volume2, VolumeX, Share2, Copy, CheckSquare, Square, Info } from 'lucide-react';
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
import { getSignedUrl, renameFile, deleteFile, formatFileSize } from '@/lib/storage';
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

interface MediaGridProps {
  items: MediaItem[];
  onUpdate: () => void;
  selectionMode?: boolean;
  selectedItems?: Set<string>;
  onSelectionChange?: (id: string) => void;
}

export function MediaGrid({ items, onUpdate, selectionMode, selectedItems, onSelectionChange }: MediaGridProps) {
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isDeleting, setIsDeleting] = useState<MediaItem | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
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
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();

  // Format time for video player (MM:SS or HH:MM:SS)
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

  // Load all thumbnails on mount with caching and parallel loading
  useEffect(() => {
    const loadAllThumbnails = async () => {
      const loadPromises = items.map(async (item) => {
        if (thumbnails[item.id]) return { id: item.id, url: thumbnails[item.id] };
        
        const cacheKey = `thumb_${item.id}`;
        const cachedUrl = sessionStorage.getItem(cacheKey);
        
        if (cachedUrl) {
          return { id: item.id, url: cachedUrl };
        }
        
        try {
          const { url } = await getSignedUrl(item.file_path);
          if (url) {
            sessionStorage.setItem(cacheKey, url);
            return { id: item.id, url };
          }
        } catch (error) {
          console.error('Error loading thumbnail:', error);
        }
        return null;
      });
      
      const results = await Promise.all(loadPromises);
      const newThumbnails: Record<string, string> = {};
      
      results.forEach(result => {
        if (result) {
          newThumbnails[result.id] = result.url;
        }
      });
      
      if (Object.keys(newThumbnails).length > 0) {
        setThumbnails(prev => ({ ...prev, ...newThumbnails }));
      }
    };
    
    loadAllThumbnails();
  }, [items]);

  const handleView = async (item: MediaItem) => {
    if (selectionMode) {
      onSelectionChange?.(item.id);
      return;
    }
    
    try {
      const { url } = await getSignedUrl(item.file_path);
      if (url) {
        setMediaUrl(url);
        setSelectedItem(item);
        setCurrentTime(0);
        setDuration(0);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tải media.',
      });
    }
  };

  const handleDownload = async (item: MediaItem) => {
    try {
      const { url } = await getSignedUrl(item.file_path);
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
        } else {
          throw new Error('Download failed');
        }
        setDownloadProgress(null);
        setDownloadXhr(null);
      });

      xhr.addEventListener('error', () => {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: 'Không thể tải file.',
          duration: 3000,
        });
        setDownloadProgress(null);
        setDownloadXhr(null);
      });

      xhr.addEventListener('abort', () => {
        toast({
          title: 'Đã hủy',
          description: 'Đã hủy tải xuống.',
          duration: 2000,
        });
        setDownloadProgress(null);
        setDownloadXhr(null);
      });

      xhr.open('GET', url);
      xhr.send();
    } catch (error) {
      console.error('Download error:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tải file.',
        duration: 3000,
      });
      setDownloadProgress(null);
      setDownloadXhr(null);
    }
  };

  const handleCancelDownload = () => {
    if (downloadXhr) {
      downloadXhr.abort();
    }
  };

  const handleRename = async (item: MediaItem) => {
    if (!newName.trim()) return;

    try {
      await renameFile(item.id, newName);
      setIsRenaming(null);
      onUpdate();
      
      toast({
        title: 'Đã đổi tên',
        description: `Đã đổi thành "${newName}"`,
        duration: 3000,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể đổi tên.',
        duration: 3000,
      });
    }
  };

  const handleDelete = async () => {
    if (!isDeleting) return;

    try {
      await deleteFile(isDeleting.id, isDeleting.file_path);
      setIsDeleting(null);
      onUpdate();
      
      toast({
        title: 'Đã xóa',
        description: `Đã xóa "${isDeleting.name}"`,
        duration: 3000,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể xóa.',
        duration: 3000,
      });
    }
  };

  const handleShare = async (item: MediaItem) => {
    if (!user) return;
    
    setShowShareDialog(item);
    setShareMaxViews('');
    setShareExpiryValue('');
    setShareExpiryUnit('hours');
    setIsPrivateMode(false);
    setAllowDownload(true);
  };

  const handleConfirmShare = async () => {
    if (!user || !showShareDialog) return;
    
    // Handle private mode - revoke share code
    if (isPrivateMode) {
      setIsGeneratingShare(showShareDialog.id);
      try {
        const { error } = await createShareCode(user.id, showShareDialog.id, 'file', null, null, true);
        if (error) throw error;
        
        toast({
          title: 'Chế độ riêng tư',
          description: 'Đã thu hồi mã chia sẻ. Nội dung này chỉ bạn có thể xem.',
          duration: 3000,
        });
        setShowShareDialog(null);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: 'Không thể thiết lập chế độ riêng tư.',
          duration: 3000,
        });
      } finally {
        setIsGeneratingShare(null);
      }
      return;
    }
    
    // Validate inputs
    const maxViews = shareMaxViews.trim() ? parseInt(shareMaxViews) : null;
    if (shareMaxViews.trim() && (isNaN(maxViews!) || maxViews! < 1)) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Số lượt xem phải là số nguyên dương.',
        duration: 3000,
      });
      return;
    }
    
    let expiresInMinutes: number | null = null;
    if (shareExpiryValue.trim()) {
      const expiryNum = parseInt(shareExpiryValue);
      if (isNaN(expiryNum) || expiryNum < 1) {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: 'Thời hạn phải là số nguyên dương.',
          duration: 3000,
        });
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
        
        let expiryText = '';
        if (expiresInMinutes) {
          if (shareExpiryUnit === 'minutes') expiryText = `, hết hạn sau ${shareExpiryValue} phút`;
          else if (shareExpiryUnit === 'hours') expiryText = `, hết hạn sau ${shareExpiryValue} giờ`;
          else if (shareExpiryUnit === 'days') expiryText = `, hết hạn sau ${shareExpiryValue} ngày`;
        }
        
        const downloadText = allowDownload ? '' : ' [Chỉ xem]';
        toast({
          title: 'Đã sao chép mã chia sẻ',
          description: `Mã: ${code}${maxViews ? ` (${maxViews} lượt xem)` : ' (không giới hạn)'}${expiryText}${downloadText}`,
          duration: 3000,
        });
      }
      setShowShareDialog(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tạo mã chia sẻ.',
        duration: 3000,
      });
    } finally {
      setIsGeneratingShare(null);
    }
  };

  const isVideo = (item: MediaItem) => item.mime_type?.startsWith('video/');

  const handleSeek = (value: number[]) => {
    if (videoRef.current && duration > 0) {
      const newTime = (value[0] / 100) * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  return (
    <>
      {/* Grid: 4 columns on mobile, more on larger screens */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1 sm:gap-2">
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative aspect-square bg-muted rounded-lg overflow-hidden group cursor-pointer ${
              selectionMode && selectedItems?.has(item.id) ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleView(item)}
          >
            {/* Selection checkbox */}
            {selectionMode && (
              <div className="absolute top-1 left-1 z-10">
                {selectedItems?.has(item.id) ? (
                  <CheckSquare className="w-5 h-5 text-primary bg-white rounded" />
                ) : (
                  <Square className="w-5 h-5 text-white/70 bg-black/30 rounded" />
                )}
              </div>
            )}

            {/* Thumbnail */}
            {thumbnails[item.id] ? (
              isVideo(item) ? (
                <video
                  src={thumbnails[item.id]}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                  playsInline
                />
              ) : (
                <>
                  {!loadedImages[item.id] && (
                    <div className="absolute inset-0 bg-muted animate-pulse" />
                  )}
                  <img
                    src={thumbnails[item.id]}
                    alt={item.name}
                    className={`w-full h-full object-cover transition-opacity ${loadedImages[item.id] ? 'opacity-100' : 'opacity-0'}`}
                    loading="eager"
                    decoding="async"
                    onLoad={() => setLoadedImages(prev => ({ ...prev, [item.id]: true }))}
                  />
                </>
              )
            ) : (
              <div className="w-full h-full bg-muted animate-pulse" />
            )}

            {/* Video indicator */}
            {isVideo(item) && downloadProgress?.id !== item.id && !selectionMode && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                  <Play className="w-5 h-5 text-white fill-white" />
                </div>
              </div>
            )}

            {/* Download progress overlay with cancel button */}
            {downloadProgress?.id === item.id && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full border-3 border-white/30 border-t-white animate-spin mb-2 mx-auto" />
                  <span className="text-white font-bold text-lg">{downloadProgress.progress}%</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelDownload();
                    }}
                    className="mt-2 text-white hover:bg-white/20"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Hủy
                  </Button>
                </div>
              </div>
            )}

            {/* Hover overlay with actions */}
            {!selectionMode && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors">
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-black/50 hover:bg-black/70 text-white">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        setShowInfoDialog(item);
                      }}>
                        <Info className="w-4 h-4 mr-2" />
                        Thông tin chi tiết
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleShare(item);
                      }} disabled={isGeneratingShare === item.id}>
                        <Share2 className="w-4 h-4 mr-2" />
                        {isGeneratingShare === item.id ? 'Đang tạo...' : 'Mã chia sẻ'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(item);
                      }}>
                        <Download className="w-4 h-4 mr-2" />
                        Tải xuống
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        setNewName(item.name);
                        setIsRenaming(item.id);
                      }}>
                        <Edit3 className="w-4 h-4 mr-2" />
                        Đổi tên
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDeleting(item);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Xóa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Preview dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => {
        setSelectedItem(null);
        setMediaUrl(null);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
      }}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-black" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedItem?.name || 'Xem media'}</DialogTitle>
          </DialogHeader>
          {selectedItem && mediaUrl && (
            <div className="relative">
              {/* 3-dot menu in top-left corner */}
              <div className="absolute top-2 left-2 z-20">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 bg-black/60 hover:bg-black/80 text-white rounded-full">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
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
                      setSelectedItem(null);
                      setMediaUrl(null);
                    }}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Đổi tên
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setIsDeleting(selectedItem);
                        setSelectedItem(null);
                        setMediaUrl(null);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Xóa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {isVideo(selectedItem) ? (
                <div className="relative group">
                  <video
                    ref={videoRef}
                    src={mediaUrl}
                    autoPlay
                    playsInline
                    muted={isMuted}
                    preload="metadata"
                    className="w-full max-h-[80vh] object-contain bg-black"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => {
                      setIsPlaying(false);
                      setCurrentTime(0);
                      if (videoRef.current) videoRef.current.currentTime = 0;
                    }}
                    onTimeUpdate={() => {
                      if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                    }}
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        setDuration(videoRef.current.duration);
                        videoRef.current.play().catch(() => {});
                      }
                    }}
                    onDurationChange={() => {
                      if (videoRef.current && videoRef.current.duration) {
                        setDuration(videoRef.current.duration);
                      }
                    }}
                    onCanPlay={() => {
                      if (videoRef.current && !isPlaying) {
                        videoRef.current.play().catch(() => {});
                      }
                    }}
                  />
                  
                  {/* Custom video controls */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Progress bar */}
                    <div className="mb-3">
                      <Slider
                        value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
                        onValueChange={handleSeek}
                        max={100}
                        step={0.1}
                        className="cursor-pointer"
                      />
                    </div>
                    
                    {/* Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 bg-white/10 hover:bg-white/20 text-white rounded-full"
                          onClick={() => {
                            if (videoRef.current) {
                              if (isPlaying) {
                                videoRef.current.pause();
                              } else {
                                videoRef.current.play();
                              }
                            }
                          }}
                        >
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 bg-white/10 hover:bg-white/20 text-white rounded-full"
                          onClick={() => setIsMuted(!isMuted)}
                        >
                          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </Button>
                        
                        {/* Time display */}
                        <span className="text-white text-sm font-mono">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 bg-white/10 hover:bg-white/20 text-white rounded-full"
                          onClick={() => {
                            if (videoRef.current) {
                              if (videoRef.current.requestFullscreen) {
                                videoRef.current.requestFullscreen();
                              }
                            }
                          }}
                        >
                          <Maximize className="w-5 h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 bg-white/10 hover:bg-white/20 text-white rounded-full"
                          onClick={() => handleDownload(selectedItem)}
                        >
                          <Download className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={mediaUrl}
                  alt={selectedItem.name}
                  className="w-full max-h-[80vh] object-contain"
                />
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pointer-events-none">
                <p className="text-white font-medium truncate">{selectedItem.name}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!isRenaming} onOpenChange={() => setIsRenaming(null)}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Đổi tên</h3>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên mới"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const item = items.find(i => i.id === isRenaming);
                  if (item) handleRename(item);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsRenaming(null)}>
                <X className="w-4 h-4 mr-2" />
                Hủy
              </Button>
              <Button onClick={() => {
                const item = items.find(i => i.id === isRenaming);
                if (item) handleRename(item);
              }}>
                <Check className="w-4 h-4 mr-2" />
                Lưu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!isDeleting} onOpenChange={() => setIsDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa "{isDeleting?.name}"? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share dialog */}
      <Dialog open={!!showShareDialog} onOpenChange={() => setShowShareDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo mã chia sẻ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Private mode toggle */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="private-media"
                checked={isPrivateMode}
                onChange={(e) => setIsPrivateMode(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="private-media" className="text-destructive font-medium">
                Riêng tư (thu hồi mã chia sẻ)
              </Label>
            </div>
            
            {/* Only show options if not private */}
            {!isPrivateMode && (
              <>
                {/* Expiry options */}
                <div>
                  <p className="text-sm font-medium mb-2">Thời hạn (để trống = không hết hạn):</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Số"
                      value={shareExpiryValue}
                      onChange={(e) => setShareExpiryValue(e.target.value)}
                      className="w-24"
                    />
                    <select
                      value={shareExpiryUnit}
                      onChange={(e) => setShareExpiryUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                      className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="minutes">Phút</option>
                      <option value="hours">Giờ</option>
                      <option value="days">Ngày</option>
                    </select>
                  </div>
                </div>
                
                {/* Views limit */}
                <div>
                  <p className="text-sm font-medium mb-2">Số lượt xem (để trống = không giới hạn):</p>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Nhập số lượt xem"
                    value={shareMaxViews}
                    onChange={(e) => setShareMaxViews(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                {/* Allow download toggle */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Cho phép tải xuống</p>
                    <p className="text-xs text-muted-foreground">Tắt nếu chỉ muốn cho xem</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={allowDownload}
                    onClick={() => setAllowDownload(!allowDownload)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      allowDownload ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        allowDownload ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowShareDialog(null)}>
                Hủy
              </Button>
              <Button onClick={handleConfirmShare} disabled={!!isGeneratingShare}>
                {isGeneratingShare ? 'Đang tạo...' : isPrivateMode ? 'Thu hồi mã' : 'Tạo mã'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info dialog */}
      <Dialog open={!!showInfoDialog} onOpenChange={() => setShowInfoDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thông tin chi tiết</DialogTitle>
          </DialogHeader>
          {showInfoDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Tên:</span>
                <span className="col-span-2 font-medium break-all">{showInfoDialog.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Loại:</span>
                <span className="col-span-2">{showInfoDialog.mime_type || showInfoDialog.file_type}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Kích thước:</span>
                <span className="col-span-2">{formatFileSize(showInfoDialog.file_size)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Ngày tạo:</span>
                <span className="col-span-2">
                  {format(new Date(showInfoDialog.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                </span>
              </div>
              <div className="flex justify-end mt-4">
                <Button variant="ghost" onClick={() => setShowInfoDialog(null)}>
                  Đóng
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
