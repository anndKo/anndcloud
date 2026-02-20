import { useState, useRef, useEffect } from 'react';
import { Send, Image, X, Flag, MoreVertical } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Message, Profile } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { useConversationMessages, useMessages } from '@/hooks/useMessages';
import { cn } from '@/lib/utils';
import { ReportDialog } from '@/components/report/ReportDialog';

interface ChatWindowProps {
  conversationId: string;
  otherUser: Profile | undefined;
}

export const ChatWindow = ({ conversationId, otherUser }: ChatWindowProps) => {
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { messages } = useConversationMessages(conversationId);
  const { sendMessage, markAsRead } = useMessages();

  useEffect(() => {
    if (conversationId) {
      markAsRead(conversationId);
    }
  }, [conversationId, markAsRead]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  const handleSend = async () => {
    if (!message.trim() && !image) return;

    setSending(true);
    await sendMessage(conversationId, message || undefined, image || undefined);
    setMessage('');
    removeImage();
    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50">
        <Avatar className="h-10 w-10">
          <AvatarImage src={otherUser?.avatar_url || ''} />
          <AvatarFallback className="gradient-primary text-primary-foreground">
            {otherUser?.display_name?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-semibold">{otherUser?.display_name}</p>
          <p className="text-sm text-muted-foreground">@{otherUser?.username}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setShowReport(true)}
              className="text-destructive cursor-pointer"
            >
              <Flag className="w-4 h-4 mr-2" />
              Báo cáo người dùng
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => {
            const isOwn = msg.sender_id === user?.id;

            return (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2 animate-fade-in',
                  isOwn ? 'justify-end' : 'justify-start'
                )}
              >
                {!isOwn && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={msg.sender?.avatar_url || ''} />
                    <AvatarFallback className="text-xs">
                      {msg.sender?.display_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-[70%] rounded-2xl px-4 py-2',
                    isOwn
                      ? 'gradient-primary text-primary-foreground rounded-br-md'
                      : 'bg-secondary text-secondary-foreground rounded-bl-md'
                  )}
                >
                  {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt="Sent"
                      className="max-w-full rounded-lg mt-1"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 py-2 border-t border-border/50">
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-20 rounded-lg object-cover"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
              onClick={removeImage}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border/50">
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
            className="text-muted-foreground hover:text-primary"
          >
            <Image className="w-5 h-5" />
          </Button>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Nhập tin nhắn..."
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={sending || (!message.trim() && !image)}
            className="gradient-primary"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Report Dialog */}
      {otherUser && (
        <ReportDialog
          open={showReport}
          onOpenChange={setShowReport}
          reportedUserId={otherUser.id}
          reportedUserName={otherUser.display_name}
        />
      )}
    </div>
  );
};
