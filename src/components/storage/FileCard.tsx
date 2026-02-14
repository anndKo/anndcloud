import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Download, 
  Edit3, 
  Trash2, 
  Image, 
  Video, 
  File, 
  Link as LinkIcon,
  ExternalLink,
  Check,
  X,
  MoreVertical,
  Copy,
  Share2,
  CheckSquare,
  Square,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { formatFileSize, getSignedUrl, renameFile, renameLink, deleteFile, deleteLink } from '@/lib/storage';
import { createShareCode } from '@/lib/share';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface FileCardProps {
  item: {
    id: string;
    name: string;
    file_path?: string;
    url?: string;
    file_type?: string;
    file_size?: number;
    mime_type?: string;
    category?: string;
    created_at: string;
  };
  type: 'file' | 'link';
  onUpdate: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (id: string) => void;
}

export function FileCard({ item, type, onUpdate, selectionMode, isSelected, onSelectionChange }: FileCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(item.name);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareMaxViews, setShareMaxViews] = useState<string>('');
  const [shareExpiryValue, setShareExpiryValue] = useState<string>('');
  const [shareExpiryUnit, setShareExpiryUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();

  const getIcon = () => {
    if (type === 'link') return <LinkIcon className="w-6 h-6" />;
    
    const mimeType = item.mime_type || '';
    if (mimeType.startsWith('image/')) return <Image className="w-6 h-6" />;
    if (mimeType.startsWith('video/')) return <Video className="w-6 h-6" />;
    return <File className="w-6 h-6" />;
  };

  const getIconBg = () => {
    if (type === 'link') return 'bg-accent/20 text-accent';
    
    const mimeType = item.mime_type || '';
    if (mimeType.startsWith('image/')) return 'bg-green-500/20 text-green-600';
    if (mimeType.startsWith('video/')) return 'bg-purple-500/20 text-purple-600';
    return 'bg-orange-500/20 text-orange-600';
  };

  const handleCopyLink = async () => {
    if (type === 'link' && item.url) {
      try {
        await navigator.clipboard.writeText(item.url);
        toast({
          title: 'Đã sao chép',
          description: 'Link đã được sao chép vào clipboard',
          duration: 3000,
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: 'Không thể sao chép link',
          duration: 3000,
        });
      }
    }
  };

  const handleDownload = async () => {
    if (type === 'link') {
      window.open(item.url, '_blank');
      return;
    }

    setIsDownloading(true);
    try {
      const { url, error } = await getSignedUrl(item.file_path!);
      if (error) throw error;

      const response = await fetch(url!);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: 'Đang tải xuống',
        description: item.name,
        duration: 3000,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi tải xuống',
        description: 'Không thể tải file. Vui lòng thử lại.',
        duration: 3000,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRename = async () => {
    if (!newName.trim()) return;

    try {
      if (type === 'file') {
        await renameFile(item.id, newName);
      } else {
        await renameLink(item.id, newName);
      }
      
      setIsRenaming(false);
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
        description: 'Không thể đổi tên. Vui lòng thử lại.',
        duration: 3000,
      });
    }
  };

  const handleDelete = async () => {
    try {
      if (type === 'file') {
        await deleteFile(item.id, item.file_path!);
      } else {
        await deleteLink(item.id);
      }
      
      setIsDeleting(false);
      onUpdate();
      
      toast({
        title: 'Đã xóa',
        description: `Đã xóa "${item.name}"`,
        duration: 3000,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể xóa. Vui lòng thử lại.',
        duration: 3000,
      });
    }
  };

  const handleShare = async () => {
    setShowShareDialog(true);
    setShareMaxViews('');
    setShareExpiryValue('');
    setShareExpiryUnit('hours');
    setIsPrivateMode(false);
  };

  const handleConfirmShare = async () => {
    if (!user) return;
    
    // Handle private mode - revoke share code
    if (isPrivateMode) {
      setIsGeneratingShare(true);
      try {
        const { error } = await createShareCode(user.id, item.id, type, null, null, true);
        if (error) throw error;
        
        toast({
          title: 'Chế độ riêng tư',
          description: 'Đã thu hồi mã chia sẻ. Nội dung này chỉ bạn có thể xem.',
          duration: 3000,
        });
        setShowShareDialog(false);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: 'Không thể thiết lập chế độ riêng tư.',
          duration: 3000,
        });
      } finally {
        setIsGeneratingShare(false);
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
    
    setIsGeneratingShare(true);
    try {
      const { code, error } = await createShareCode(user.id, item.id, type, maxViews, expiresInMinutes, false);
      if (error) throw error;
      
      if (code) {
        await navigator.clipboard.writeText(code);
        
        let expiryText = '';
        if (expiresInMinutes) {
          if (shareExpiryUnit === 'minutes') expiryText = `, hết hạn sau ${shareExpiryValue} phút`;
          else if (shareExpiryUnit === 'hours') expiryText = `, hết hạn sau ${shareExpiryValue} giờ`;
          else if (shareExpiryUnit === 'days') expiryText = `, hết hạn sau ${shareExpiryValue} ngày`;
        }
        
        toast({
          title: 'Đã sao chép mã chia sẻ',
          description: `Mã: ${code}${maxViews ? ` (${maxViews} lượt xem)` : ' (không giới hạn)'}${expiryText}`,
          duration: 3000,
        });
      }
      setShowShareDialog(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tạo mã chia sẻ.',
        duration: 3000,
      });
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const handleClick = () => {
    if (selectionMode) {
      onSelectionChange?.(item.id);
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`file-card cursor-pointer ${selectionMode && isSelected ? 'ring-2 ring-primary' : ''}`}
        onClick={handleClick}
      >
        <div className="flex items-start gap-3">
          {/* Selection checkbox */}
          {selectionMode && (
            <div className="flex-shrink-0 pt-1">
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-primary" />
              ) : (
                <Square className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          )}

          {/* Icon */}
          <div className={`p-3 rounded-xl ${getIconBg()}`}>
            {getIcon()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                    if (e.key === 'Escape') setIsRenaming(false);
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRename();
                  }}
                  className="h-8 w-8"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRenaming(false);
                  }}
                  className="h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <h3 className="font-medium text-foreground truncate">
                  {item.name}
                </h3>
                {type === 'link' && item.url && (
                  <p 
                    className="text-xs text-primary truncate cursor-pointer hover:underline mt-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyLink();
                    }}
                    title="Nhấn để sao chép link"
                  >
                    {item.url}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  {type === 'file' && item.file_size && (
                    <>
                      <span>{formatFileSize(item.file_size)}</span>
                      <span>•</span>
                    </>
                  )}
                  <span>
                    {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          {!isRenaming && !selectionMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  setShowInfoDialog(true);
                }}>
                  <Info className="w-4 h-4 mr-2" />
                  Thông tin chi tiết
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }} disabled={isGeneratingShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  {isGeneratingShare ? 'Đang tạo...' : 'Mã chia sẻ'}
                </DropdownMenuItem>
                {type === 'link' && (
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    handleCopyLink();
                  }}>
                    <Copy className="w-4 h-4 mr-2" />
                    Sao chép link
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }} disabled={isDownloading}>
                  {type === 'link' ? (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Mở link
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Tải xuống
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  setNewName(item.name);
                  setIsRenaming(true);
                }}>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Đổi tên
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDeleting(true);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Xóa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </motion.div>

      {/* Delete confirmation */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa "{item.name}"? Hành động này không thể hoàn tác.
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
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Tạo mã chia sẻ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Private mode toggle */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`private-${item.id}`}
                checked={isPrivateMode}
                onChange={(e) => setIsPrivateMode(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor={`private-${item.id}`} className="text-destructive font-medium">
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
              </>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowShareDialog(false)}>
                Hủy
              </Button>
              <Button onClick={handleConfirmShare} disabled={isGeneratingShare}>
                {isGeneratingShare ? 'Đang tạo...' : isPrivateMode ? 'Thu hồi mã' : 'Tạo mã'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Thông tin chi tiết</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-muted-foreground">Tên:</span>
              <span className="col-span-2 font-medium break-all">{item.name}</span>
            </div>
            {type === 'file' && (
              <>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-muted-foreground">Loại:</span>
                  <span className="col-span-2">{item.mime_type || item.file_type}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-muted-foreground">Kích thước:</span>
                  <span className="col-span-2">{formatFileSize(item.file_size || 0)}</span>
                </div>
              </>
            )}
            {type === 'link' && (
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">URL:</span>
                <span className="col-span-2 break-all text-primary">{item.url}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-muted-foreground">Ngày tạo:</span>
              <span className="col-span-2">
                {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
              </span>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="ghost" onClick={() => setShowInfoDialog(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
