import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Type, Save, X, Loader2, Trash2, ChevronDown, Plus,
  Heading1, Heading2, Heading3, Quote, Code, Undo, Redo, Strikethrough
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

interface TextDocument {
  id: string;
  title: string;
  content: string;
  font_size: number;
  font_family: string;
  text_align: string;
  created_at: string;
  updated_at: string;
}

const FONT_FAMILIES = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Comic Sans MS', label: 'Comic Sans MS' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Tahoma', label: 'Tahoma' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' },
  { value: 'Palatino Linotype', label: 'Palatino' },
  { value: 'Lucida Console', label: 'Lucida Console' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Garamond', label: 'Garamond' },
  { value: 'Book Antiqua', label: 'Book Antiqua' },
  { value: 'Century Gothic', label: 'Century Gothic' },
  { value: 'Brush Script MT', label: 'Brush Script' },
  { value: 'Copperplate', label: 'Copperplate' },
  { value: 'Rockwell', label: 'Rockwell' },
  { value: 'Segoe UI', label: 'Segoe UI' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
];

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

interface TextEditorProps {
  document?: TextDocument | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TextEditor({ document, onClose, onSaved }: TextEditorProps) {
  const [title, setTitle] = useState(document?.title || 'Tài liệu mới');
  const [content, setContent] = useState(document?.content || '');
  const [fontSize, setFontSize] = useState(document?.font_size || 16);
  const [fontFamily, setFontFamily] = useState(document?.font_family || 'Arial');
  const [textAlign, setTextAlign] = useState(document?.text_align || 'left');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Track changes
  useEffect(() => {
    if (document) {
      const changed = 
        title !== document.title ||
        content !== document.content ||
        fontSize !== document.font_size ||
        fontFamily !== document.font_family ||
        textAlign !== document.text_align;
      setHasChanges(changed);
    } else {
      setHasChanges(content.length > 0 || title !== 'Tài liệu mới');
    }
  }, [title, content, fontSize, fontFamily, textAlign, document]);

  // Apply formatting commands using window.document
  const execCommand = useCallback((command: string, value?: string) => {
    window.document.execCommand(command, false, value);
    editorRef.current?.focus();
    // Update content state
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  }, []);

  // Handle content changes
  const handleContentChange = () => {
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  };

  // Save document
  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const data = {
        title: title.trim() || 'Tài liệu mới',
        content,
        font_size: fontSize,
        font_family: fontFamily,
        text_align: textAlign,
        user_id: user.id,
      };

      if (document?.id) {
        // Update existing
        const { error } = await supabase
          .from('user_texts' as any)
          .update(data)
          .eq('id', document.id);
        
        if (error) throw error;
        
        toast({
          title: 'Đã lưu',
          description: 'Văn bản đã được cập nhật.',
          duration: 2000,
        });
      } else {
        // Create new
        const { error } = await supabase
          .from('user_texts' as any)
          .insert(data);
        
        if (error) throw error;
        
        toast({
          title: 'Đã lưu',
          description: 'Văn bản mới đã được tạo.',
          duration: 2000,
        });
      }
      
      setHasChanges(false);
      onSaved();
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: error.message || 'Không thể lưu văn bản.',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete document
  const handleDelete = async () => {
    if (!document?.id) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('user_texts' as any)
        .delete()
        .eq('id', document.id);
      
      if (error) throw error;
      
      toast({
        title: 'Đã xóa',
        description: 'Văn bản đã được xóa.',
        duration: 2000,
      });
      
      onSaved();
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: error.message || 'Không thể xóa văn bản.',
        duration: 3000,
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Handle close with unsaved changes warning
  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="shrink-0"
              >
                <X className="w-5 h-5" />
              </Button>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-medium text-lg border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
                placeholder="Tiêu đề tài liệu"
              />
            </div>
            
            <div className="flex items-center gap-2">
              {document?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              )}
            <Button
              onClick={handleSave}
              disabled={isSaving || (!hasChanges && !!document?.id)}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Lưu
            </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b bg-muted/30 overflow-x-auto">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center gap-1 flex-wrap">
            {/* Font family */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1 min-w-[120px] justify-between">
                  <span className="truncate text-xs">{fontFamily}</span>
                  <ChevronDown className="w-3 h-3 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {FONT_FAMILIES.map((font) => (
                  <DropdownMenuItem
                    key={font.value}
                    onClick={() => {
                      setFontFamily(font.value);
                      execCommand('fontName', font.value);
                    }}
                    style={{ fontFamily: font.value }}
                  >
                    {font.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Font size */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1 min-w-[60px] justify-between">
                  <span className="text-xs">{fontSize}</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
                {FONT_SIZES.map((size) => (
                  <DropdownMenuItem
                    key={size}
                    onClick={() => {
                      setFontSize(size);
                      execCommand('fontSize', '7');
                    }}
                  >
                    {size}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Text formatting */}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('bold')}>
              <Bold className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('italic')}>
              <Italic className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('underline')}>
              <Underline className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('strikeThrough')}>
              <Strikethrough className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Headings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1">
                  <Type className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => execCommand('formatBlock', 'p')}>
                  Văn bản thường
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => execCommand('formatBlock', 'h1')}>
                  <Heading1 className="w-4 h-4 mr-2" /> Tiêu đề 1
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => execCommand('formatBlock', 'h2')}>
                  <Heading2 className="w-4 h-4 mr-2" /> Tiêu đề 2
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => execCommand('formatBlock', 'h3')}>
                  <Heading3 className="w-4 h-4 mr-2" /> Tiêu đề 3
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => execCommand('formatBlock', 'blockquote')}>
                  <Quote className="w-4 h-4 mr-2" /> Trích dẫn
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => execCommand('formatBlock', 'pre')}>
                  <Code className="w-4 h-4 mr-2" /> Code
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Alignment */}
            <Button 
              variant={textAlign === 'left' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="h-8 w-8"
              onClick={() => { setTextAlign('left'); execCommand('justifyLeft'); }}
            >
              <AlignLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant={textAlign === 'center' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="h-8 w-8"
              onClick={() => { setTextAlign('center'); execCommand('justifyCenter'); }}
            >
              <AlignCenter className="w-4 h-4" />
            </Button>
            <Button 
              variant={textAlign === 'right' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="h-8 w-8"
              onClick={() => { setTextAlign('right'); execCommand('justifyRight'); }}
            >
              <AlignRight className="w-4 h-4" />
            </Button>
            <Button 
              variant={textAlign === 'justify' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="h-8 w-8"
              onClick={() => { setTextAlign('justify'); execCommand('justifyFull'); }}
            >
              <AlignJustify className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Lists */}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('insertUnorderedList')}>
              <List className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('insertOrderedList')}>
              <ListOrdered className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Undo/Redo */}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('undo')}>
              <Undo className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('redo')}>
              <Redo className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-auto bg-muted/10">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div
            ref={editorRef}
            contentEditable
            className="min-h-[calc(100vh-200px)] bg-background rounded-lg shadow-sm border p-8 focus:outline-none focus:ring-2 focus:ring-primary/20 prose prose-sm max-w-none"
            style={{
              fontFamily,
              fontSize: `${fontSize}px`,
              textAlign: textAlign as any,
            }}
            onInput={handleContentChange}
            onPaste={(e) => {
              e.preventDefault();
              const text = e.clipboardData.getData('text/plain');
              window.document.execCommand('insertText', false, text);
            }}
            dangerouslySetInnerHTML={{ __html: content }}
            suppressContentEditableWarning
          />
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa văn bản</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa "{title}"? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

// Text document list component
interface TextListProps {
  onCreateNew: () => void;
  onEdit: (doc: TextDocument) => void;
  verifiedPin?: string | null;
}

export function TextList({ onCreateNew, onEdit, verifiedPin }: TextListProps) {
  const [documents, setDocuments] = useState<TextDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      if (verifiedPin) {
        // Use edge function for PIN-protected access
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
          body: JSON.stringify({ pin: verifiedPin, action: 'texts' }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setDocuments(data.texts || []);
        } else {
          throw new Error('Failed to fetch texts');
        }
      } else {
        const { data, error } = await supabase
          .from('user_texts' as any)
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });
        
        if (error) throw error;
        setDocuments((data as any) || []);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tải danh sách văn bản.',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
          <Type className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground">Chưa có văn bản</h3>
        <p className="text-muted-foreground mt-1">Tạo văn bản mới để bắt đầu</p>
        <Button onClick={onCreateNew} className="mt-4">
          <Plus className="w-4 h-4 mr-2" />
          Tạo văn bản mới
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onCreateNew} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Tạo mới
        </Button>
      </div>
      
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((doc) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onEdit(doc)}
          >
            <h4 className="font-medium text-foreground truncate">{doc.title}</h4>
            <p 
              className="text-sm text-muted-foreground mt-1 line-clamp-2"
              dangerouslySetInnerHTML={{ 
                __html: doc.content.replace(/<[^>]*>/g, ' ').slice(0, 100) || 'Không có nội dung' 
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(doc.updated_at).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
