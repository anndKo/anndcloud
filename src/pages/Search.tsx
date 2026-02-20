import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search as SearchIcon, UserPlus, MessageCircle, Check, Clock } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Profile, Friendship } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Profile & { friendshipStatus?: Friendship | null })[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { user } = useAuth();
  const { getOrCreateConversation } = useMessages();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!query.trim() || !user) return;
    
    setLoading(true);
    setSearched(true);
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`search_id.ilike.%${query}%,username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq('id', user.id)
      .limit(20);
    
    if (data) {
      // Check friendship status for each user
      const resultsWithStatus = await Promise.all(
        data.map(async (profile) => {
          const { data: friendship } = await supabase
            .from('friendships')
            .select('*')
            .or(`and(requester_id.eq.${user.id},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${user.id})`)
            .maybeSingle();
          
          return { ...profile, friendshipStatus: friendship as Friendship | null };
        })
      );
      setResults(resultsWithStatus);
    }
    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSendFriendRequest = async (profileId: string) => {
    if (!user) return;
    
    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: profileId,
    });
    
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể gửi lời mời kết bạn', variant: 'destructive' });
    } else {
      toast({ title: 'Thành công', description: 'Đã gửi lời mời kết bạn' });
      // Update local state
      setResults(prev => prev.map(p => 
        p.id === profileId 
          ? { ...p, friendshipStatus: { status: 'pending', requester_id: user.id } as Friendship }
          : p
      ));
    }
  };

  const handleMessage = async (profileId: string) => {
    const conversationId = await getOrCreateConversation(profileId);
    if (conversationId) {
      navigate(`/messages?conversation=${conversationId}`);
    } else {
      toast({ title: 'Lỗi', description: 'Không thể tạo cuộc trò chuyện', variant: 'destructive' });
    }
  };

  const getFriendButtonContent = (profile: Profile & { friendshipStatus?: Friendship | null }) => {
    const fs = profile.friendshipStatus;
    
    if (!fs) {
      return (
        <Button
          size="sm"
          onClick={() => handleSendFriendRequest(profile.id)}
          className="gap-2 gradient-primary"
        >
          <UserPlus className="w-4 h-4" />
          Kết bạn
        </Button>
      );
    }
    
    if (fs.status === 'accepted') {
      return (
        <Button size="sm" variant="secondary" disabled className="gap-2">
          <Check className="w-4 h-4" />
          Bạn bè
        </Button>
      );
    }
    
    if (fs.status === 'pending') {
      return (
        <Button size="sm" variant="outline" disabled className="gap-2">
          <Clock className="w-4 h-4" />
          Đã gửi
        </Button>
      );
    }
    
    return (
      <Button
        size="sm"
        onClick={() => handleSendFriendRequest(profile.id)}
        className="gap-2"
      >
        <UserPlus className="w-4 h-4" />
        Kết bạn
      </Button>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <Card className="glass-card mb-6">
            <CardContent className="p-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Tìm kiếm theo ID, tên người dùng..."
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch} className="gradient-primary">
                  Tìm kiếm
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-4 glass-card rounded-xl">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : searched && results.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-8 text-center text-muted-foreground">
                <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Không tìm thấy kết quả nào</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {results.map((profile) => (
                <Card key={profile.id} className="glass-card">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Link to={`/profile/${profile.id}`}>
                      <Avatar className="h-12 w-12 ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                        <AvatarImage src={profile.avatar_url || ''} />
                        <AvatarFallback className="gradient-primary text-primary-foreground">
                          {profile.display_name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1">
                      <Link to={`/profile/${profile.id}`} className="hover:underline">
                        <p className="font-medium">{profile.display_name}</p>
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        @{profile.username} · ID: {profile.search_id}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMessage(profile.id)}
                        className="gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                      {getFriendButtonContent(profile)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
