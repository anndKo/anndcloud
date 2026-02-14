import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, ImagePlus, File, Link as LinkIcon, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { uploadFile, saveFileMetadata, saveLink, uploadThumbnail, UploadProgress } from '@/lib/storage';
import { generateThumbnail } from '@/lib/thumbnail';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface UploadZoneProps {
  onUploadComplete: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error' | 'cancelled';
  error?: string;
  abortController?: AbortController;
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  const getFileCategory = (file: File): 'media' | 'file' => {
    const mediaTypes = ['image/', 'video/'];
    return mediaTypes.some(type => file.type.startsWith(type)) ? 'media' : 'file';
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!user) return;

    const fileArray = Array.from(files);
    
    // Initialize upload state
    setUploadingFiles(prev => [
      ...prev,
      ...fileArray.map(file => ({
        file,
        progress: 0,
        status: 'uploading' as const,
      })),
    ]);

    // Upload all files in parallel
    const uploadPromises = fileArray.map(async (file) => {
      const category = getFileCategory(file);
      const fileExt = file.name.split('.').pop() || '';

      try {
        // Start thumbnail generation in parallel with upload
        const thumbPromise = generateThumbnail(file);

        const { path, error } = await uploadFile(
          file,
          user.id,
          category,
          (progress: UploadProgress) => {
            setUploadingFiles(prev =>
              prev.map(f =>
                f.file === file
                  ? { ...f, progress: progress.percentage }
                  : f
              )
            );
          }
        );

        if (error) throw error;

        // Wait for thumbnail and upload it
        let thumbnailUrl: string | null = null;
        const thumbBlob = await thumbPromise;
        if (thumbBlob) {
          const { url } = await uploadThumbnail(thumbBlob, user.id, category);
          thumbnailUrl = url;
        }

        // Save metadata with thumbnail URL
        await saveFileMetadata(
          user.id,
          file.name,
          file.name,
          path,
          fileExt,
          file.size,
          file.type,
          category,
          thumbnailUrl
        );

        setUploadingFiles(prev =>
          prev.map(f =>
            f.file === file
              ? { ...f, status: 'success' as const, progress: 100 }
              : f
          )
        );

        onUploadComplete();
      } catch (error) {
        setUploadingFiles(prev =>
          prev.map(f =>
            f.file === file
              ? { ...f, status: 'error' as const, error: (error as Error).message }
              : f
          )
        );

        toast({
          variant: 'destructive',
          title: 'Lỗi tải lên',
          description: `Không thể tải lên ${file.name}`,
        });
      }
    });

    await Promise.all(uploadPromises);

    // Clear completed uploads after delay
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(f => f.status === 'uploading'));
    }, 3000);
  }, [user, onUploadComplete, toast]);

  const handleCancelUpload = useCallback((file: File) => {
    setUploadingFiles(prev =>
      prev.map(f =>
        f.file === file && f.status === 'uploading'
          ? { ...f, status: 'cancelled' as const }
          : f
      )
    );
    
    toast({
      title: 'Đã hủy',
      description: `Đã hủy tải lên ${file.name}`,
      duration: 2000,
    });
    
    // Remove after a short delay
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(f => f.file !== file || f.status === 'uploading'));
    }, 1500);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleAddLink = async () => {
    if (!user || !linkUrl.trim()) return;

    setIsSubmittingLink(true);
    try {
      const name = linkName.trim() || new URL(linkUrl).hostname;
      await saveLink(user.id, name, linkUrl);
      
      toast({
        title: 'Đã lưu link',
        description: 'Link đã được thêm vào kho lưu trữ.',
      });

      setLinkUrl('');
      setLinkName('');
      setLinkDialogOpen(false);
      onUploadComplete();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể lưu link. Vui lòng kiểm tra URL.',
      });
    } finally {
      setIsSubmittingLink(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`upload-zone ${isDragging ? 'upload-zone-active' : ''}`}
      >
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ scale: isDragging ? 1.1 : 1 }}
            className="gradient-primary p-4 rounded-2xl"
          >
            <Upload className="w-8 h-8 text-white" />
          </motion.div>
          
          <div className="text-center">
            <p className="font-medium text-foreground">
              Kéo thả file vào đây
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              hoặc nhấn để chọn file (tối đa 20GB/file)
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {/* Single button for photos and videos */}
            <label>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileInput}
              />
              <span className="action-btn-secondary cursor-pointer">
                <ImagePlus className="w-4 h-4" />
                Ảnh & Video
              </span>
            </label>

            <label>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
              <span className="action-btn-secondary cursor-pointer">
                <File className="w-4 h-4" />
                File
              </span>
            </label>

            <Button
              variant="secondary"
              onClick={() => setLinkDialogOpen(true)}
              className="action-btn-secondary"
            >
              <LinkIcon className="w-4 h-4" />
              Link
            </Button>
          </div>
        </div>
      </div>

      {/* Upload progress */}
      <AnimatePresence>
        {uploadingFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {uploadingFiles.map((item, index) => (
              <motion.div
                key={`${item.file.name}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass-card rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  {item.status === 'uploading' && (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  )}
                  {item.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-success" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  )}
                  {item.status === 'cancelled' && (
                    <X className="w-5 h-5 text-muted-foreground" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.file.name}
                      {item.status === 'cancelled' && <span className="text-muted-foreground ml-2">(Đã hủy)</span>}
                    </p>
                    <div className="progress-bar mt-1">
                      <motion.div
                        className={`progress-bar-fill ${item.status === 'cancelled' ? 'bg-muted' : ''}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                  
                  <span className="text-sm text-muted-foreground">
                    {item.progress}%
                  </span>
                  
                  {/* Cancel button - only show when uploading */}
                  {item.status === 'uploading' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleCancelUpload(item.file)}
                      title="Hủy tải lên"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Link dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm Link</DialogTitle>
            <DialogDescription>
              Lưu trữ link để truy cập nhanh sau này
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">URL</label>
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Tên (tùy chọn)</label>
              <Input
                placeholder="Tên để nhận dạng"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
              />
            </div>

            <Button
              onClick={handleAddLink}
              disabled={!linkUrl.trim() || isSubmittingLink}
              className="w-full gradient-primary"
            >
              {isSubmittingLink ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Lưu Link'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
