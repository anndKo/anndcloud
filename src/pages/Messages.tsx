import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { ChatList } from '@/components/chat/ChatList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useMessages } from '@/hooks/useMessages';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const { conversations, loading, refreshConversations } = useMessages();

  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId) {
      setSelectedConversation(conversationId);
    }
  }, [searchParams]);

  const handleSelectConversation = (convId: string) => {
    setSelectedConversation(convId);
    setSearchParams({ conversation: convId });
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setSearchParams({});
  };

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="glass-card rounded-2xl overflow-hidden h-[calc(100vh-10rem)]">
          <div className="flex h-full">
            {/* Conversation List - Hidden on mobile when chat is open */}
            <div className={`w-full md:w-80 border-r border-border/50 flex flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-border/50">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  Tin nhắn
                </h2>
              </div>
              <div className="flex-1 overflow-hidden">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ChatList
                    conversations={conversations}
                    selectedId={selectedConversation}
                    onSelect={handleSelectConversation}
                  />
                )}
              </div>
            </div>

            {/* Chat Window - Desktop */}
            <div className="hidden md:flex flex-1 flex-col">
              {selectedConversation && selectedConv ? (
                <ChatWindow
                  conversationId={selectedConversation}
                  otherUser={selectedConv.other_user}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Chọn một cuộc trò chuyện để bắt đầu</p>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Window - Mobile */}
            {selectedConversation && selectedConv && (
              <div className="md:hidden flex flex-col flex-1">
                <div className="p-2 border-b border-border/50">
                  <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Quay lại
                  </Button>
                </div>
                <div className="flex-1">
                  <ChatWindow
                    conversationId={selectedConversation}
                    otherUser={selectedConv.other_user}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
