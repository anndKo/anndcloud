import { Link } from 'react-router-dom';
import { UserPlus, Check, X, MessageCircle } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFriendships } from '@/hooks/useFriendships';
import { useMessages } from '@/hooks/useMessages';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export default function Friends() {
  const {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
  } = useFriendships();
  const { getOrCreateConversation } = useMessages();
  const navigate = useNavigate();

  const handleMessage = async (userId: string) => {
    const conversationId = await getOrCreateConversation(userId);
    if (conversationId) {
      navigate(`/messages?conversation=${conversationId}`);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <Tabs defaultValue="friends">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="friends">
                Bạn bè ({friends.length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Lời mời ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger value="sent">
                Đã gửi ({sentRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="friends">
              {friends.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Chưa có bạn bè nào</p>
                    <Link to="/search">
                      <Button variant="link" className="mt-2">
                        Tìm kiếm bạn bè
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {friends.map((friend) => (
                    <Card key={friend.id} className="glass-card">
                      <CardContent className="flex items-center gap-3 p-4">
                        <Link to={`/profile/${friend.id}`}>
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={friend.avatar_url || ''} />
                            <AvatarFallback className="gradient-primary text-primary-foreground">
                              {friend.display_name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="flex-1">
                          <Link to={`/profile/${friend.id}`} className="hover:underline">
                            <p className="font-medium">{friend.display_name}</p>
                          </Link>
                          <p className="text-sm text-muted-foreground">@{friend.username}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMessage(friend.id)}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending">
              {pendingRequests.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p>Không có lời mời kết bạn nào</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <Card key={request.id} className="glass-card">
                      <CardContent className="flex items-center gap-3 p-4">
                        <Link to={`/profile/${request.requester_id}`}>
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={request.requester?.avatar_url || ''} />
                            <AvatarFallback className="gradient-primary text-primary-foreground">
                              {request.requester?.display_name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="flex-1">
                          <Link to={`/profile/${request.requester_id}`} className="hover:underline">
                            <p className="font-medium">{request.requester?.display_name}</p>
                          </Link>
                          <p className="text-sm text-muted-foreground">@{request.requester?.username}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gradient-primary"
                            onClick={() => acceptFriendRequest(request.id)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectFriendRequest(request.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sent">
              {sentRequests.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p>Chưa gửi lời mời kết bạn nào</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {sentRequests.map((request) => (
                    <Card key={request.id} className="glass-card">
                      <CardContent className="flex items-center gap-3 p-4">
                        <Link to={`/profile/${request.addressee_id}`}>
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={request.addressee?.avatar_url || ''} />
                            <AvatarFallback className="gradient-primary text-primary-foreground">
                              {request.addressee?.display_name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="flex-1">
                          <Link to={`/profile/${request.addressee_id}`} className="hover:underline">
                            <p className="font-medium">{request.addressee?.display_name}</p>
                          </Link>
                          <p className="text-sm text-muted-foreground">@{request.addressee?.username}</p>
                        </div>
                        <span className="text-sm text-muted-foreground">Đang chờ</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
