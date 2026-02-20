import { useState, useEffect, useCallback } from 'react';
import { supabase, uploadFile } from '@/lib/supabase';
import { Conversation, Message, Profile } from '@/types/database';
import { useAuth } from './useAuth';

export const useMessages = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const { data: participantData } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, last_read_at')
        .eq('user_id', user.id);
      
      if (!participantData?.length) {
        setConversations([]);
        setLoading(false);
        return;
      }
      
      const conversationIds = participantData.map(p => p.conversation_id);
      const conversationsWithDetails: Conversation[] = [];
      
      for (const convId of conversationIds) {
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('*')
          .eq('conversation_id', convId);
        
        const otherParticipant = participants?.find(p => p.user_id !== user.id);
        let otherProfile: Profile | undefined;
        
        if (otherParticipant) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', otherParticipant.user_id)
            .single();
          otherProfile = profile as Profile;
        }
        
        const { data: lastMessageData } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        const userParticipant = participants?.find(p => p.user_id === user.id);
        let unreadCount = 0;
        
        if (userParticipant) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', convId)
            .neq('sender_id', user.id)
            .gt('created_at', userParticipant.last_read_at);
          
          unreadCount = count || 0;
        }
        
        conversationsWithDetails.push({
          id: convId,
          created_at: '',
          updated_at: '',
          last_message: lastMessageData?.[0] as Message,
          other_user: otherProfile,
          unread_count: unreadCount,
        });
      }
      
      conversationsWithDetails.sort((a, b) => {
        const timeA = a.last_message?.created_at || '';
        const timeB = b.last_message?.created_at || '';
        return timeB.localeCompare(timeA);
      });
      
      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
    setLoading(false);
  }, [user]);

  const getOrCreateConversation = async (otherUserId: string): Promise<string | null> => {
    if (!user) return null;
    
    try {
      // Check existing conversations
      const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);
      
      if (myParticipations) {
        for (const p of myParticipations) {
          const { data: otherP } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('conversation_id', p.conversation_id)
            .eq('user_id', otherUserId)
            .maybeSingle();
          
          if (otherP) {
            return p.conversation_id;
          }
        }
      }
      
      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();
      
      if (convError || !newConv) {
        console.error('Error creating conversation:', convError);
        return null;
      }
      
      // Add participants
      const { error: partError } = await supabase.from('conversation_participants').insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: otherUserId },
      ]);
      
      if (partError) {
        console.error('Error adding participants:', partError);
        return null;
      }
      
      await fetchConversations();
      return newConv.id;
    } catch (error) {
      console.error('Error in getOrCreateConversation:', error);
      return null;
    }
  };

  const sendMessage = async (conversationId: string, content?: string, imageFile?: File) => {
    if (!user) return { error: 'Not authenticated' };
    
    let imageUrl = null;
    
    if (imageFile) {
      const path = `${user.id}/${Date.now()}-${imageFile.name}`;
      imageUrl = await uploadFile('chat-images', path, imageFile);
    }
    
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      image_url: imageUrl,
    });
    
    return { error };
  };

  const markAsRead = async (conversationId: string) => {
    if (!user) return;
    
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      )
    );
  };

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('messages-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchConversations();
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  return { conversations, loading, getOrCreateConversation, sendMessage, markAsRead, refreshConversations: fetchConversations };
};

export const useConversationMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (data) {
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', senderIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      setMessages(data.map(m => ({ ...m, sender: profileMap.get(m.sender_id) as Profile })));
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!conversationId) return;
    
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
        const newMsg = payload.new as any;
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', newMsg.sender_id).single();
        setMessages(prev => [...prev, { ...newMsg, sender: profile as Profile }]);
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  return { messages, loading, refreshMessages: fetchMessages };
};
