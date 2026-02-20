import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Cloud, Camera, Image, File, Link as LinkIcon, LogOut, RefreshCw, Loader2, Search, X, MoreVertical, CheckSquare, Trash2, Share2, Download, Play, Eye, Type, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { getUserFiles, getUserLinks, uploadFile, saveFileMetadata, deleteFile, deleteLink, getSignedUrl, formatFileSize } from '@/lib/storage';
import { getSharedItemSecure } from '@/lib/share';
import { UploadZone } from '@/components/storage/UploadZone';
import { FileCard } from '@/components/storage/FileCard';
import { VirtualizedMediaGrid } from '@/components/storage/VirtualizedMediaGrid';
import { CameraCapture } from '@/components/storage/CameraCapture';
import { TextEditor, TextList } from '@/components/storage/TextEditor';
import { StoragePasswordSetup, StoragePasswordGate } from '@/components/storage/StoragePasswordLock';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
type Tab = 'media' | 'files' | 'links' | 'texts';
interface FileItem {
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
interface LinkItem {
  id: string;
  name: string;
  url: string;
  created_at: string;
}
export default function StoragePage() {
  // Password protection state
  const [passwordEnabled, setPasswordEnabled] = useState<boolean | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [verifiedPin, setVerifiedPin] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>('media');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState<{
    name: string;
    progress: number;
  } | null>(null);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Share code input
  const [showShareInput, setShowShareInput] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [isLoadingShare, setIsLoadingShare] = useState(false);
  const [sharedItem, setSharedItem] = useState<{
    item: any;
    type: 'file' | 'link';
    previewUrl?: string;
    allowDownload?: boolean;
  } | null>(null);

  // Download progress for shared item
  const [sharedDownloadProgress, setSharedDownloadProgress] = useState<number | null>(null);
  const [sharedDownloadXhr, setSharedDownloadXhr] = useState<XMLHttpRequest | null>(null);

  // Fullscreen preview for shared item
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  
  // Text editor state
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [editingDocument, setEditingDocument] = useState<any>(null);
  const [textsRefreshKey, setTextsRefreshKey] = useState(0);
  const {
    user,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (passwordEnabled && verifiedPin) {
        // Use edge function (server-side PIN verification, bypasses RLS)
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        
        const response = await fetch(`${supabaseUrl}/functions/v1/secure-storage-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ pin: verifiedPin, action: 'all' }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.files) setFiles(data.files);
          if (data.links) setLinks(data.links);
        } else {
          throw new Error('Failed to fetch secure data');
        }
      } else {
        // No PIN protection - direct query
        const [filesResult, linksResult] = await Promise.all([getUserFiles(user.id), getUserLinks(user.id)]);
        if (filesResult.data) setFiles(filesResult.data as any);
        if (linksResult.data) setLinks(linksResult.data as any);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tải dữ liệu. Vui lòng thử lại.',
        duration: 3000
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, passwordEnabled, verifiedPin]);
  // Check password protection status
  useEffect(() => {
    if (!user) return;
    const checkPassword = async () => {
      const { data } = await supabase
        .from('storage_passwords')
        .select('is_enabled')
        .eq('user_id', user.id)
        .single() as any;
      const enabled = !!data?.is_enabled;
      setPasswordEnabled(enabled);
      if (!enabled) setIsUnlocked(true);
    };
    checkPassword();
  }, [user]);

  // Lock when tab becomes hidden or page reloads
  useEffect(() => {
    if (!passwordEnabled) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsUnlocked(false);
        setVerifiedPin(null);
        setFiles([]);
        setLinks([]);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [passwordEnabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };
  const handleCameraCapture = async (file: File) => {
    if (!user) return;
    setUploadingMedia({
      name: file.name,
      progress: 0
    });
    try {
      const category = 'media';
      const {
        path,
        error
      } = await uploadFile(file, user.id, category, progress => {
        setUploadingMedia({
          name: file.name,
          progress: progress.percentage
        });
      });
      if (error) throw error;
      await saveFileMetadata(user.id, file.name, file.name, path, file.name.split('.').pop() || '', file.size, file.type, category);
      toast({
        title: 'Đã lưu',
        description: file.type.startsWith('video/') ? 'Video đã được lưu.' : 'Ảnh đã được lưu.',
        duration: 3000
      });
      fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể lưu. Vui lòng thử lại.',
        duration: 3000
      });
    } finally {
      setTimeout(() => setUploadingMedia(null), 1500);
    }
  };

  // Selection handlers
  const handleSelectionChange = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  const handleSelectAll = () => {
    const currentItems = activeTab === 'media' ? filteredData.mediaFiles : activeTab === 'files' ? filteredData.otherFiles : filteredData.links;
    if (selectedItems.size === currentItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(currentItems.map(item => item.id)));
    }
  };
  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;
    try {
      const deletePromises: Promise<any>[] = [];
      selectedItems.forEach(id => {
        if (activeTab === 'links') {
          deletePromises.push(deleteLink(id));
        } else {
          const file = files.find(f => f.id === id);
          if (file) {
            deletePromises.push(deleteFile(id, file.file_path));
          }
        }
      });
      await Promise.all(deletePromises);
      toast({
        title: 'Đã xóa',
        description: `Đã xóa ${selectedItems.size} mục`,
        duration: 3000
      });
      setSelectedItems(new Set());
      setSelectionMode(false);
      setIsDeleting(false);
      fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể xóa một số mục.',
        duration: 3000
      });
    }
  };
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedItems(new Set());
  };

  // Bulk download handler
  const handleDownloadSelected = async () => {
    if (selectedItems.size === 0 || activeTab === 'links') return;
    const selectedFiles = files.filter(f => selectedItems.has(f.id));
    toast({
      title: 'Đang tải xuống',
      description: `Đang tải ${selectedFiles.length} tệp...`,
      duration: 2000
    });
    for (const file of selectedFiles) {
      try {
        const {
          url,
          error
        } = await getSignedUrl(file.file_path);
        if (error || !url) continue;
        const response = await fetch(url);
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);

        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error('Download error:', error);
      }
    }
    toast({
      title: 'Hoàn tất',
      description: `Đã tải ${selectedFiles.length} tệp`,
      duration: 3000
    });
  };

  // Share code handler - using secure RPC function
  const handleShareCodeSubmit = async () => {
    if (!shareCode.trim()) return;
    setIsLoadingShare(true);
    try {
      const {
        item,
        type,
        allowDownload,
        signedUrl,
        error
      } = await getSharedItemSecure(shareCode.trim());
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: error.message,
          duration: 3000
        });
        return;
      }
      if (item && type) {
        // signedUrl is already fetched via Edge Function for files
        setSharedItem({
          item,
          type,
          previewUrl: signedUrl,
          allowDownload
        });
        setShowShareInput(false);
        setShareCode('');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tìm thấy mã chia sẻ.',
        duration: 3000
      });
    } finally {
      setIsLoadingShare(false);
    }
  };

  // Download shared item with progress and cancel
  const handleDownloadSharedItem = async () => {
    if (!sharedItem || sharedItem.type === 'link' || !sharedItem.previewUrl) return;
    try {
      setSharedDownloadProgress(0);
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'blob';
      setSharedDownloadXhr(xhr);
      xhr.addEventListener('progress', event => {
        if (event.lengthComputable) {
          const progress = Math.round(event.loaded / event.total * 100);
          setSharedDownloadProgress(progress);
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const blob = xhr.response;
          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = sharedItem.item.name || 'download';
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(downloadUrl);
          toast({
            title: 'Đã tải xuống',
            description: `${sharedItem.item.name} (${formatFileSize(sharedItem.item.file_size)})`,
            duration: 3000
          });
        }
        setSharedDownloadProgress(null);
        setSharedDownloadXhr(null);
      });
      xhr.addEventListener('error', () => {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: 'Không thể tải file.',
          duration: 3000
        });
        setSharedDownloadProgress(null);
        setSharedDownloadXhr(null);
      });
      xhr.addEventListener('abort', () => {
        toast({
          title: 'Đã hủy',
          description: 'Đã hủy tải xuống.',
          duration: 2000
        });
        setSharedDownloadProgress(null);
        setSharedDownloadXhr(null);
      });
      xhr.open('GET', sharedItem.previewUrl);
      xhr.send();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tải file.',
        duration: 3000
      });
      setSharedDownloadProgress(null);
      setSharedDownloadXhr(null);
    }
  };
  const handleCancelSharedDownload = () => {
    if (sharedDownloadXhr) {
      sharedDownloadXhr.abort();
    }
  };
  const handleOpenSharedLink = () => {
    if (!sharedItem || sharedItem.type !== 'link') return;
    window.open(sharedItem.item.url, '_blank');
  };

  // Filter data based on search query
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const mediaFiles = files.filter(f => f.category === 'media');
    const otherFiles = files.filter(f => f.category === 'file');
    if (!query) {
      return {
        mediaFiles,
        otherFiles,
        links
      };
    }
    return {
      mediaFiles: mediaFiles.filter(f => f.name.toLowerCase().includes(query) || f.file_type?.toLowerCase().includes(query) || f.mime_type?.toLowerCase().includes(query)),
      otherFiles: otherFiles.filter(f => f.name.toLowerCase().includes(query) || f.file_type?.toLowerCase().includes(query) || f.mime_type?.toLowerCase().includes(query)),
      links: links.filter(l => l.name.toLowerCase().includes(query) || l.url.toLowerCase().includes(query))
    };
  }, [files, links, searchQuery]);
  const {
    mediaFiles,
    otherFiles,
    links: filteredLinks
  } = filteredData;
  const currentItemsCount = activeTab === 'media' ? mediaFiles.length : activeTab === 'files' ? otherFiles.length : filteredLinks.length;
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Show password gate if enabled and not unlocked
  if (passwordEnabled && !isUnlocked && user) {
    return <StoragePasswordGate userId={user.id} onUnlock={(pin: string) => { setVerifiedPin(pin); setIsUnlocked(true); }} />;
  }

  // Still checking password status
  if (passwordEnabled === null) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return <div className="min-h-screen gradient-bg">
      {/* Header */}
      <motion.header initial={{
      y: -20,
      opacity: 0
    }} animate={{
      y: 0,
      opacity: 1
    }} className="sticky top-0 z-40 glass-card border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="gradient-primary p-2 rounded-xl">
                <Cloud className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-display font-bold text-gradient">Annd Cloud</h1>
            </div>

            <div className="flex items-center gap-2">
              {selectionMode ? (
                <Button variant="ghost" size="icon" onClick={exitSelectionMode} className="rounded-full">
                  <X className="w-5 h-5" />
                </Button>
              ) : isMobile ? (
                /* Mobile: Refresh button visible + Hamburger menu */
                <>
                  <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading} className="rounded-full gap-1.5 text-xs px-3">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Làm mới
                  </Button>
                  <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        <Menu className="w-5 h-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-64">
                      <SheetHeader>
                        <SheetTitle>Menu</SheetTitle>
                      </SheetHeader>
                      <div className="flex flex-col gap-2 mt-4">
                        <Button variant="ghost" className="justify-start" onClick={() => { setShowShareInput(true); setMobileMenuOpen(false); }}>
                          <Share2 className="w-5 h-5 mr-3" />
                          Nhập mã chia sẻ
                        </Button>
                        <Button variant="ghost" className="justify-start" onClick={() => { setShowCamera(true); setMobileMenuOpen(false); }}>
                          <Camera className="w-5 h-5 mr-3" />
                          Chụp ảnh/Quay video
                        </Button>
                        <Button variant="ghost" className="justify-start" onClick={() => { setSelectionMode(true); setMobileMenuOpen(false); }}>
                          <CheckSquare className="w-5 h-5 mr-3" />
                          Chọn nhiều
                        </Button>
                        <div className="px-2 py-1">
                          {user && <StoragePasswordSetup userId={user.id} />}
                        </div>
                        <DropdownMenuSeparator />
                        <Button variant="ghost" className="justify-start text-destructive hover:text-destructive" onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}>
                          <LogOut className="w-5 h-5 mr-3" />
                          Đăng xuất
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              ) : (
                /* Desktop: Normal buttons */
                <>
                  <Button variant="ghost" size="icon" onClick={() => setShowShareInput(true)} className="rounded-full" title="Nhập mã chia sẻ">
                    <Share2 className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading} className="rounded-full">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowCamera(true)} className="rounded-full">
                    <Camera className="w-5 h-5" />
                  </Button>
                  
                  {/* 3-dot menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        <MoreVertical className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectionMode(true)}>
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Chọn nhiều
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5">
                        {user && <StoragePasswordSetup userId={user.id} />}
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                        <LogOut className="w-4 h-4 mr-2" />
                        Đăng xuất
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Search bar */}
        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input placeholder="Tìm kiếm theo tên, loại file (jpg, mp4, pdf...)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 pr-10" />
          {searchQuery && <Button variant="ghost" size="icon" onClick={() => setSearchQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
              <X className="w-4 h-4" />
            </Button>}
        </motion.div>

        {/* Upload Zone */}
        {!selectionMode && <motion.section initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.1
      }}>
            <UploadZone onUploadComplete={fetchData} />
          </motion.section>}

        {/* Tabs */}
        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.2
      }} className="flex gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          <button onClick={() => {
          setActiveTab('media');
          if (selectionMode) setSelectedItems(new Set());
        }} className={`tab-item flex-shrink-0 text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 ${activeTab === 'media' ? 'tab-item-active' : ''}`}>
            <Image className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
            Ảnh & Video
            {mediaFiles.length > 0 && <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                {mediaFiles.length}
              </span>}
          </button>
          <button onClick={() => {
          setActiveTab('files');
          if (selectionMode) setSelectedItems(new Set());
        }} className={`tab-item flex-shrink-0 text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 ${activeTab === 'files' ? 'tab-item-active' : ''}`}>
            <File className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
            File
            {otherFiles.length > 0 && <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                {otherFiles.length}
              </span>}
          </button>
          <button onClick={() => {
          setActiveTab('links');
          if (selectionMode) setSelectedItems(new Set());
        }} className={`tab-item flex-shrink-0 text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 ${activeTab === 'links' ? 'tab-item-active' : ''}`}>
            <LinkIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
            Link
            {filteredLinks.length > 0 && <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                {filteredLinks.length}
              </span>}
          </button>
          <button onClick={() => {
          setActiveTab('texts');
          if (selectionMode) setSelectedItems(new Set());
        }} className={`tab-item flex-shrink-0 text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 ${activeTab === 'texts' ? 'tab-item-active' : ''}`}>
            <Type className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
            Văn bản
          </button>
        </motion.div>

        {/* Content */}
        <motion.section initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} transition={{
        delay: 0.3
      }}>
          {loading ? <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div> : <AnimatePresence mode="wait">
              {activeTab === 'media' ? <motion.div key="media" initial={{
            opacity: 0,
            x: -20
          }} animate={{
            opacity: 1,
            x: 0
          }} exit={{
            opacity: 0,
            x: 20
          }}>
                  {mediaFiles.length === 0 && !uploadingMedia ? <div className="text-center py-20">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
                        <Image className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground">
                        {searchQuery ? 'Không tìm thấy' : 'Chưa có ảnh hoặc video'}
                      </h3>
                      <p className="text-muted-foreground mt-1">
                        {searchQuery ? 'Thử tìm với từ khóa khác' : 'Chụp ảnh hoặc tải lên để bắt đầu'}
                      </p>
                    </div> : <>
                      {uploadingMedia && <motion.div initial={{
                opacity: 0,
                y: -10
              }} animate={{
                opacity: 1,
                y: 0
              }} className="mb-4 glass-card rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{uploadingMedia.name}</p>
                              <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
                                <motion.div className="h-full bg-primary rounded-full" initial={{
                        width: 0
                      }} animate={{
                        width: `${uploadingMedia.progress}%`
                      }} transition={{
                        duration: 0.3
                      }} />
                              </div>
                            </div>
                            <span className="text-sm font-medium text-primary">
                              {uploadingMedia.progress}%
                            </span>
                          </div>
                        </motion.div>}
                      <VirtualizedMediaGrid items={mediaFiles} onUpdate={fetchData} selectionMode={selectionMode} selectedItems={selectedItems} onSelectionChange={handleSelectionChange} />
                    </>}
                </motion.div> : activeTab === 'files' ? <motion.div key="files" initial={{
            opacity: 0,
            x: 20
          }} animate={{
            opacity: 1,
            x: 0
          }} exit={{
            opacity: 0,
            x: -20
          }} className="space-y-3">
                  {otherFiles.length === 0 ? <div className="text-center py-20">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
                        <File className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground">
                        {searchQuery ? 'Không tìm thấy' : 'Chưa có file'}
                      </h3>
                      <p className="text-muted-foreground mt-1">
                        {searchQuery ? 'Thử tìm với từ khóa khác' : 'Tải file để bắt đầu'}
                      </p>
                    </div> : <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {otherFiles.map(file => <FileCard key={file.id} item={file} type="file" onUpdate={fetchData} selectionMode={selectionMode} isSelected={selectedItems.has(file.id)} onSelectionChange={handleSelectionChange} />)}
                    </div>}
                </motion.div> : activeTab === 'links' ? <motion.div key="links" initial={{
            opacity: 0,
            x: 20
          }} animate={{
            opacity: 1,
            x: 0
          }} exit={{
            opacity: 0,
            x: -20
          }} className="space-y-3">
                  {filteredLinks.length === 0 ? <div className="text-center py-20">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
                        <LinkIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground">
                        {searchQuery ? 'Không tìm thấy' : 'Chưa có link'}
                      </h3>
                      <p className="text-muted-foreground mt-1">
                        {searchQuery ? 'Thử tìm với từ khóa khác' : 'Thêm link để bắt đầu'}
                      </p>
                    </div> : <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredLinks.map(link => <FileCard key={link.id} item={link} type="link" onUpdate={fetchData} selectionMode={selectionMode} isSelected={selectedItems.has(link.id)} onSelectionChange={handleSelectionChange} />)}
                    </div>}
                </motion.div> : activeTab === 'texts' ? <motion.div key="texts" initial={{
            opacity: 0,
            x: 20
          }} animate={{
            opacity: 1,
            x: 0
          }} exit={{
            opacity: 0,
            x: -20
          }}>
                  <TextList 
                    key={textsRefreshKey}
                    verifiedPin={verifiedPin}
                    onCreateNew={() => {
                      setEditingDocument(null);
                      setShowTextEditor(true);
                    }}
                    onEdit={(doc) => {
                      setEditingDocument(doc);
                      setShowTextEditor(true);
                    }}
                  />
                </motion.div> : null}
            </AnimatePresence>}
        </motion.section>
      </main>

      {/* Selection mode fixed bottom bar */}
      <AnimatePresence>
        {selectionMode && <motion.div initial={{
        y: 100,
        opacity: 0
      }} animate={{
        y: 0,
        opacity: 1
      }} exit={{
        y: 100,
        opacity: 0
      }} className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t p-4 safe-area-inset-bottom">
            <div className="container mx-auto flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
              <Button variant="outline" onClick={handleSelectAll} size="sm">
                {selectedItems.size === currentItemsCount ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </Button>
              
              {/* Download button - only for files, not links */}
              {activeTab !== 'links' && <Button variant="secondary" onClick={handleDownloadSelected} disabled={selectedItems.size === 0} size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Tải ({selectedItems.size})
                </Button>}
              
              <Button variant="destructive" onClick={() => setIsDeleting(true)} disabled={selectedItems.size === 0} size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Xóa ({selectedItems.size})
              </Button>
              <Button variant="ghost" onClick={exitSelectionMode} size="sm">
                Hủy
              </Button>
            </div>
          </motion.div>}
      </AnimatePresence>

      {/* Camera overlay */}
      <AnimatePresence>
        {showCamera && <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa {selectedItems.size} mục đã chọn? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share code input dialog */}
      <Dialog open={showShareInput} onOpenChange={setShowShareInput}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nhập mã chia sẻ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nhập mã chia sẻ (VD: ABC12345)" value={shareCode} onChange={e => setShareCode(e.target.value.toUpperCase())} autoFocus onKeyDown={e => {
            if (e.key === 'Enter') handleShareCodeSubmit();
          }} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowShareInput(false)}>
                Hủy
              </Button>
              <Button onClick={handleShareCodeSubmit} disabled={isLoadingShare || !shareCode.trim()}>
                {isLoadingShare ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Xem
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shared item viewer */}
      <Dialog open={!!sharedItem && !showFullscreenPreview} onOpenChange={() => {
      setSharedItem(null);
      handleCancelSharedDownload();
    }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nội dung được chia sẻ</DialogTitle>
          </DialogHeader>
          {sharedItem && <div className="space-y-4">
              {/* Preview thumbnail with fullscreen button */}
              {sharedItem.type === 'file' && sharedItem.previewUrl && <div className="relative rounded-lg overflow-hidden bg-black group">
                  {sharedItem.item.mime_type?.startsWith('image/') ? <img src={sharedItem.previewUrl} alt={sharedItem.item.name} className="w-full max-h-[40vh] object-contain" /> : sharedItem.item.mime_type?.startsWith('video/') ? <div className="relative">
                      <video src={sharedItem.previewUrl} className="w-full max-h-[40vh] object-contain" preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Play className="w-16 h-16 text-white/80" />
                      </div>
                    </div> : <div className="p-8 text-center bg-muted">
                      <File className="w-16 h-16 mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">Không thể xem trước file này</p>
                    </div>}
                  
                  {/* Fullscreen preview button */}
                  {(sharedItem.item.mime_type?.startsWith('image/') || sharedItem.item.mime_type?.startsWith('video/')) && <Button onClick={() => setShowFullscreenPreview(true)} className="absolute bottom-3 right-3 bg-black/70 hover:bg-black/90 text-white" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      Xem trước
                    </Button>}
                </div>}
              
              {/* File/Link info */}
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{sharedItem.item.name}</p>
                {sharedItem.type === 'link' && <p className="text-sm text-muted-foreground truncate mt-1">{sharedItem.item.url}</p>}
                {sharedItem.type === 'file' && sharedItem.item.file_size && <p className="text-sm text-muted-foreground mt-1">
                    {formatFileSize(sharedItem.item.file_size)}
                  </p>}
              </div>
              
              {/* Download progress bar */}
              {sharedDownloadProgress !== null && <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Đang tải xuống...</span>
                    <span className="font-mono">{sharedDownloadProgress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{
                width: `${sharedDownloadProgress}%`
              }} />
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCancelSharedDownload} className="w-full">
                    <X className="w-4 h-4 mr-2" />
                    Hủy tải xuống
                  </Button>
                </div>}
              
              {/* Action buttons */}
              {sharedDownloadProgress === null && <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setSharedItem(null)}>
                    Đóng
                  </Button>
                  {sharedItem.type === 'link' ? <Button onClick={handleOpenSharedLink}>
                      <LinkIcon className="w-4 h-4 mr-2" />
                      Mở link
                    </Button> : sharedItem.allowDownload !== false ? <Button onClick={handleDownloadSharedItem}>
                      <Download className="w-4 h-4 mr-2" />
                      Tải xuống
                    </Button> : <span className="text-sm text-muted-foreground italic py-2">
                      Chỉ xem, không tải xuống
                    </span>}
                </div>}
            </div>}
        </DialogContent>
      </Dialog>

      {/* Fullscreen preview modal */}
      <AnimatePresence>
        {showFullscreenPreview && sharedItem && sharedItem.previewUrl && <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} exit={{
        opacity: 0
      }} className="fixed inset-0 z-[100] bg-black flex flex-col">
            {/* Header */}
            <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
              <Button variant="ghost" size="icon" onClick={() => setShowFullscreenPreview(false)} className="text-white hover:bg-white/20 rounded-full w-12 h-12">
                <X className="w-6 h-6" />
              </Button>
              <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full max-w-[60%] truncate">
                {sharedItem.item.name}
              </span>
              {/* 3-dot menu - only show download option if allowed */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full w-12 h-12">
                    <MoreVertical className="w-6 h-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {sharedItem.allowDownload !== false ? <DropdownMenuItem onClick={handleDownloadSharedItem}>
                      <Download className="w-4 h-4 mr-2" />
                      Tải xuống
                    </DropdownMenuItem> : <DropdownMenuItem disabled className="text-muted-foreground">
                      Chỉ xem, không tải xuống
                    </DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-4">
              {sharedItem.item.mime_type?.startsWith('image/') ? <motion.img initial={{
            scale: 0.9
          }} animate={{
            scale: 1
          }} src={sharedItem.previewUrl} alt={sharedItem.item.name} className="max-w-full max-h-full object-contain" /> : sharedItem.item.mime_type?.startsWith('video/') ? <video src={sharedItem.previewUrl} controls autoPlay playsInline preload="metadata" className="max-w-full max-h-full" onLoadStart={e => {
            const video = e.currentTarget;
            video.play().catch(() => {});
          }}>
                  Trình duyệt không hỗ trợ video.
                </video> : null}
            </div>
          </motion.div>}
      </AnimatePresence>

      {/* Text Editor */}
      <AnimatePresence>
        {showTextEditor && (
          <TextEditor
            document={editingDocument}
            onClose={() => {
              setShowTextEditor(false);
              setEditingDocument(null);
            }}
            onSaved={() => setTextsRefreshKey(prev => prev + 1)}
          />
        )}
      </AnimatePresence>
    </div>;
}