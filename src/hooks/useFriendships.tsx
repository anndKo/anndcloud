import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Friendship, Profile } from '@/types/database';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export const useFriendships = () => {
  const [friends, setFriends] = useState<Profile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [sentRequests, setSentRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchFriendships = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    const { data: friendships } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted');
    
    if (friendships) {
      const friendIds = friendships.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', friendIds);
      setFriends((profiles as Profile[]) || []);
    }
    
    const { data: pending } = await supabase
      .from('friendships')
      .select('*')
      .eq('addressee_id', user.id)
      .eq('status', 'pending');
    
    if (pending) {
      const requesterIds = pending.map(p => p.requester_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', requesterIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      setPendingRequests(pending.map(p => ({ ...p, requester: profileMap.get(p.requester_id) as Profile })) as Friendship[]);
    }
    
    const { data: sent } = await supabase
      .from('friendships')
      .select('*')
      .eq('requester_id', user.id)
      .eq('status', 'pending');
    
    if (sent) {
      const addresseeIds = sent.map(s => s.addressee_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', addresseeIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      setSentRequests(sent.map(s => ({ ...s, addressee: profileMap.get(s.addressee_id) as Profile })) as Friendship[]);
    }
    
    setLoading(false);
  }, [user]);

  const sendFriendRequest = async (addresseeId: string) => {
    if (!user) return { error: 'Not authenticated' };
    
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`)
      .maybeSingle();
    
    if (existing) return { error: 'Friendship already exists' };
    
    const { error } = await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: addresseeId });
    
    if (!error) {
      await fetchFriendships();
      toast({ title: 'Thành công', description: 'Đã gửi lời mời kết bạn' });
    }
    return { error };
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    if (!error) { await fetchFriendships(); toast({ title: 'Thành công', description: 'Đã chấp nhận lời mời kết bạn' }); }
    return { error };
  };

  const rejectFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').update({ status: 'rejected' }).eq('id', friendshipId);
    if (!error) await fetchFriendships();
    return { error };
  };

  const removeFriend = async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (!error) { await fetchFriendships(); toast({ title: 'Thành công', description: 'Đã hủy kết bạn' }); }
    return { error };
  };

  const getFriendshipStatus = async (otherUserId: string) => {
    if (!user) return null;
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`)
      .maybeSingle();
    return data as Friendship | null;
  };

  useEffect(() => { fetchFriendships(); }, [fetchFriendships]);

  return { friends, pendingRequests, sentRequests, loading, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend, getFriendshipStatus, refreshFriendships: fetchFriendships };
};
