import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Conversation } from '@/types/database';
import { cn } from '@/lib/utils';

interface ChatListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
}

export const ChatList = ({ conversations, selectedId, onSelect }: ChatListProps) => {
  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Chưa có cuộc trò chuyện nào</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {conversations.map((conversation) => {
          const isSelected = selectedId === conversation.id;
          const hasUnread = (conversation.unread_count || 0) > 0;

          return (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200',
                isSelected
                  ? 'bg-primary/10 border border-primary/20'
                  : 'hover:bg-secondary/50',
                hasUnread && !isSelected && 'bg-accent/50'
              )}
            >
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={conversation.other_user?.avatar_url || ''} />
                  <AvatarFallback className="gradient-primary text-primary-foreground">
                    {conversation.other_user?.display_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                {hasUnread && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
                    {conversation.unread_count}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className={cn(
                  'font-medium truncate',
                  hasUnread && 'text-foreground'
                )}>
                  {conversation.other_user?.display_name}
                </p>
                <p className={cn(
                  'text-sm truncate',
                  hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}>
                  {conversation.last_message?.content || 'Đã gửi hình ảnh'}
                </p>
              </div>
              {conversation.last_message && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(conversation.last_message.created_at), {
                    addSuffix: false,
                    locale: vi,
                  })}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
};
