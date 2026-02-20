import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, MessageCircle, UserPlus, UserMinus, Check, X, Copy } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PostCard } from '@/components/post/PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { supabase, uploadFile } from '@/lib/supabase';
import { Profile as ProfileType, Friendship } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { usePosts } from '@/hooks/usePosts';
import { useFriendships } from '@/hooks/useFriendships';
import { useMessages } from '@/hooks/useMessages';
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, profile: currentUserProfile, refreshProfile } = useAuth();
  const { posts, loading: postsLoading, deletePost } = usePosts(userId);
  const { sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend, getFriendshipStatus } = useFriendships();
  const { getOrCreateConversation } = useMessages();
  const { toast } = useToast();

  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;
      
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (data) {
        setProfile(data as ProfileType);
        setBio(data.bio || '');
      }
      setLoading(false);
    };

    fetchProfile();
  }, [userId]);

  useEffect(() => {
    const checkFriendship = async () => {
      if (!userId || isOwnProfile) return;
      const status = await getFriendshipStatus(userId);
      setFriendship(status);
    };

    checkFriendship();
  }, [userId, isOwnProfile, getFriendshipStatus]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const path = `${user.id}/avatar-${Date.now()}`;
    const url = await uploadFile('avatars', path, file);
    
    if (url) {
      await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id);
      
      setProfile(prev => prev ? { ...prev, avatar_url: url } : null);
      refreshProfile();
      toast({ title: 'Đã cập nhật ảnh đại diện' });
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const path = `${user.id}/cover-${Date.now()}`;
    const url = await uploadFile('covers', path, file);
    
    if (url) {
      await supabase
        .from('profiles')
        .update({ cover_url: url })
        .eq('id', user.id);
      
      setProfile(prev => prev ? { ...prev, cover_url: url } : null);
      toast({ title: 'Đã cập nhật ảnh bìa' });
    }
  };

  const handleSaveBio = async () => {
    if (!user) return;
    
    await supabase
      .from('profiles')
      .update({ bio })
      .eq('id', user.id);
    
    setProfile(prev => prev ? { ...prev, bio } : null);
    setEditingBio(false);
    toast({ title: 'Đã cập nhật tiểu sử' });
  };

  const handleMessage = async () => {
    if (!userId) return;
    const conversationId = await getOrCreateConversation(userId);
    if (conversationId) {
      navigate(`/messages?conversation=${conversationId}`);
    }
  };

  const handleFriendAction = async () => {
    if (!userId) return;

    if (!friendship) {
      await sendFriendRequest(userId);
      const status = await getFriendshipStatus(userId);
      setFriendship(status);
    } else if (friendship.status === 'pending') {
      if (friendship.addressee_id === user?.id) {
        await acceptFriendRequest(friendship.id);
      }
      const status = await getFriendshipStatus(userId);
      setFriendship(status);
    } else if (friendship.status === 'accepted') {
      await removeFriend(friendship.id);
      setFriendship(null);
    }
  };

  const copySearchId = () => {
    if (profile?.search_id) {
      navigator.clipboard.writeText(profile.search_id);
      toast({ title: 'Đã sao chép ID' });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="max-w-4xl mx-auto -mt-16 px-4">
            <Skeleton className="h-32 w-32 rounded-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-muted-foreground">Không tìm thấy người dùng</p>
        </div>
      </Layout>
    );
  }

  const getFriendButtonContent = () => {
    if (!friendship) {
      return (
        <>
          <UserPlus className="w-4 h-4" />
          Thêm bạn
        </>
      );
    }
    if (friendship.status === 'pending') {
      if (friendship.addressee_id === user?.id) {
        return (
          <>
            <Check className="w-4 h-4" />
            Chấp nhận
          </>
        );
      }
      return 'Đã gửi lời mời';
    }
    if (friendship.status === 'accepted') {
      return (
        <>
          <UserMinus className="w-4 h-4" />
          Hủy kết bạn
        </>
      );
    }
    return 'Thêm bạn';
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        {/* Cover */}
        <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden bg-gradient-to-r from-primary/20 to-accent">
          {profile.cover_url && (
            <img
              src={profile.cover_url}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
          {isOwnProfile && (
            <>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={coverInputRef}
                onChange={handleCoverChange}
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-4 right-4 gap-2"
                onClick={() => coverInputRef.current?.click()}
              >
                <Camera className="w-4 h-4" />
                Đổi ảnh bìa
              </Button>
            </>
          )}
        </div>

        {/* Profile Info */}
        <div className="max-w-4xl mx-auto -mt-16 px-4">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="h-32 w-32 ring-4 ring-background">
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback className="gradient-primary text-primary-foreground text-4xl">
                  {profile.display_name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={avatarInputRef}
                    onChange={handleAvatarChange}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{profile.display_name}</h1>
              <p className="text-muted-foreground">@{profile.username}</p>
              <button
                onClick={copySearchId}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
              >
                ID: {profile.search_id}
                <Copy className="w-3 h-3" />
              </button>
            </div>

            {/* Actions */}
            {!isOwnProfile && (
              <div className="flex gap-2">
                <Button onClick={handleMessage} variant="outline" className="gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Nhắn tin
                </Button>
                <Button
                  onClick={handleFriendAction}
                  className="gradient-primary gap-2"
                  disabled={friendship?.status === 'pending' && friendship?.requester_id === user?.id}
                >
                  {getFriendButtonContent()}
                </Button>
              </div>
            )}
          </div>

          {/* Bio */}
          <div className="mt-6 glass-card p-4 rounded-xl">
            {isOwnProfile && editingBio ? (
              <div className="space-y-2">
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Viết gì đó về bạn..."
                  className="min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveBio}>Lưu</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingBio(false)}>Hủy</Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-foreground whitespace-pre-wrap">
                  {profile.bio || (isOwnProfile ? 'Thêm tiểu sử...' : 'Chưa có tiểu sử')}
                </p>
                {isOwnProfile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setEditingBio(true)}
                  >
                    Chỉnh sửa
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Posts */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Bài viết</h2>
            {postsLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-48 w-full rounded-xl" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Chưa có bài viết nào</p>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onDelete={isOwnProfile ? (id) => deletePost(id) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
