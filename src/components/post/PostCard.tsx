import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MoreHorizontal, Trash2, Heart, MessageCircle, Share2, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Post, PostComment } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { usePostComments } from '@/hooks/usePosts';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PostCardProps {
  post: Post;
  onDelete?: (postId: string) => void;
  onLike?: (postId: string) => void;
}

export const PostCard = ({ post, onDelete, onLike }: PostCardProps) => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const { comments, addComment, deleteComment } = usePostComments(post.id);
  
  const isOwner = user?.id === post.user_id;
  const canDelete = isOwner || isAdmin;

  const handleComment = async () => {
    if (!commentText.trim()) return;
    await addComment(commentText);
    setCommentText('');
  };

  const handleShare = () => {
    const url = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Đã sao chép link bài viết' });
  };

  return (
    <Card className="glass-card overflow-hidden animate-fade-in hover:shadow-lg transition-all duration-300">
      <CardHeader className="flex flex-row items-center gap-3 p-4">
        <Link to={`/profile/${post.user_id}`}>
          <Avatar className="h-12 w-12 ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
            <AvatarImage src={post.profile?.avatar_url || ''} />
            <AvatarFallback className="gradient-primary text-primary-foreground">
              {post.profile?.display_name?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1">
          <Link to={`/profile/${post.user_id}`} className="hover:underline">
            <p className="font-semibold">{post.profile?.display_name}</p>
          </Link>
          <p className="text-sm text-muted-foreground">
            @{post.profile?.username} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: vi })}
          </p>
        </div>
        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onDelete?.(post.id)}
                className="text-destructive cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Xóa bài viết
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {post.content && (
          <p className="text-foreground whitespace-pre-wrap mb-3">{post.content}</p>
        )}
        {post.image_url && (
          <div className="rounded-xl overflow-hidden mb-3">
            <img
              src={post.image_url}
              alt="Post"
              className="w-full object-cover max-h-[500px] hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        
        {/* Actions */}
        <div className="flex items-center gap-1 pt-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLike?.(post.id)}
            className={cn(
              "gap-2 flex-1",
              post.is_liked && "text-red-500"
            )}
          >
            <Heart className={cn("w-5 h-5", post.is_liked && "fill-current")} />
            <span>{post.likes_count || 0}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="gap-2 flex-1"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{post.comments_count || 0}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="gap-2 flex-1"
          >
            <Share2 className="w-5 h-5" />
            <span>Chia sẻ</span>
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
            {/* Comment Input */}
            <div className="flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Viết bình luận..."
                onKeyPress={(e) => e.key === 'Enter' && handleComment()}
                className="flex-1"
              />
              <Button size="icon" onClick={handleComment} disabled={!commentText.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Comments List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2 p-2 bg-secondary/30 rounded-lg">
                  <Link to={`/profile/${comment.user_id}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.profile?.avatar_url || ''} />
                      <AvatarFallback className="text-xs">
                        {comment.profile?.display_name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/profile/${comment.user_id}`} className="text-sm font-medium hover:underline">
                        {comment.profile?.display_name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: vi })}
                      </span>
                    </div>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                  {(user?.id === comment.user_id || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => deleteComment(comment.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
