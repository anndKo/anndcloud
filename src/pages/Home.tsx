import { Layout } from '@/components/layout/Layout';
import { CreatePostForm } from '@/components/post/CreatePostForm';
import { PostCard } from '@/components/post/PostCard';
import { usePosts } from '@/hooks/usePosts';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const { posts, loading, deletePost, likePost } = usePosts();
  const { toast } = useToast();

  const handleDeletePost = async (postId: string) => {
    const { error } = await deletePost(postId);
    if (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa bài viết',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Thành công',
        description: 'Đã xóa bài viết',
      });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <CreatePostForm />
          
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-48 w-full rounded-xl" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Chưa có bài viết nào</p>
              <p className="text-sm text-muted-foreground mt-1">Hãy là người đầu tiên đăng bài!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={handleDeletePost}
                  onLike={likePost}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
