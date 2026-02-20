import { useState, useRef } from 'react';
import { Image, X, Send, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { usePosts } from '@/hooks/usePosts';
import { useToast } from '@/hooks/use-toast';

export const CreatePostForm = () => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile } = useAuth();
  const { createPost } = usePosts();
  const { toast } = useToast();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && !image) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập nội dung hoặc thêm hình ảnh',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await createPost(content, image || undefined);
    setLoading(false);

    if (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể đăng bài viết',
        variant: 'destructive',
      });
    } else {
      setContent('');
      removeImage();
      toast({
        title: 'Thành công',
        description: 'Đã đăng bài viết',
      });
    }
  };

  return (
    <Card className="glass-card p-4">
      <div className="flex gap-3">
        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
          <AvatarImage src={profile?.avatar_url || ''} />
          <AvatarFallback className="gradient-primary text-primary-foreground">
            {profile?.display_name?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-3">
          <Textarea
            placeholder="Bạn đang nghĩ gì?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] resize-none border-0 bg-secondary/50 focus-visible:ring-1 focus-visible:ring-primary"
          />
          
          {imagePreview && (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-48 rounded-xl object-cover"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                onClick={removeImage}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageSelect}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:text-primary/80"
              >
                <Image className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-primary hover:text-primary/80"
              >
                <Smile className="w-5 h-5" />
              </Button>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={loading || (!content.trim() && !image)}
              className="gradient-primary shadow-glow gap-2"
            >
              <Send className="w-4 h-4" />
              Đăng
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
