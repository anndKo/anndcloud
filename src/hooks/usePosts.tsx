import { useState, useEffect, useCallback } from 'react';
import { supabase, uploadFile } from '@/lib/supabase';
import { Post, Profile, PostComment } from '@/types/database';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export const usePosts = (userId?: string) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    
    let query = supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải bài viết',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }
    
    // Fetch profiles, likes counts, comments counts
    const userIds = [...new Set(data?.map(p => p.user_id) || [])];
    const postIds = data?.map(p => p.id) || [];
    
    const [profilesRes, likesRes, commentsRes, userLikesRes] = await Promise.all([
      supabase.from('profiles').select('*').in('id', userIds),
      supabase.from('post_likes').select('post_id').in('post_id', postIds),
      supabase.from('post_comments').select('post_id').in('post_id', postIds),
      user ? supabase.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', user.id) : { data: [] },
    ]);
    
    const profileMap = new Map(profilesRes.data?.map(p => [p.id, p]) || []);
    const likesCount = new Map<string, number>();
    const commentsCount = new Map<string, number>();
    const userLikes = new Set(userLikesRes.data?.map(l => l.post_id) || []);
    
    likesRes.data?.forEach(l => {
      likesCount.set(l.post_id, (likesCount.get(l.post_id) || 0) + 1);
    });
    
    commentsRes.data?.forEach(c => {
      commentsCount.set(c.post_id, (commentsCount.get(c.post_id) || 0) + 1);
    });
    
    const postsWithData = (data || []).map(post => ({
      ...post,
      profile: profileMap.get(post.user_id) as Profile,
      likes_count: likesCount.get(post.id) || 0,
      comments_count: commentsCount.get(post.id) || 0,
      is_liked: userLikes.has(post.id),
    }));
    
    // Shuffle posts for random display if no specific userId
    if (!userId) {
      postsWithData.sort(() => Math.random() - 0.5);
    }
    setPosts(postsWithData);
    setLoading(false);
  }, [userId, user, toast]);

  const createPost = async (content: string, imageFile?: File) => {
    if (!user) return { error: 'Not authenticated' };
    
    let imageUrl = null;
    
    if (imageFile) {
      const path = `${user.id}/${Date.now()}-${imageFile.name}`;
      imageUrl = await uploadFile('posts', path, imageFile);
      
      if (!imageUrl) {
        return { error: 'Failed to upload image' };
      }
    }
    
    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      content,
      image_url: imageUrl,
    });
    
    if (!error) {
      await fetchPosts();
    }
    
    return { error };
  };

  const deletePost = async (postId: string) => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);
    
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== postId));
    }
    
    return { error };
  };

  const likePost = async (postId: string) => {
    if (!user) return;
    
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    if (post.is_liked) {
      // Unlike
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, is_liked: false, likes_count: (p.likes_count || 1) - 1 }
          : p
      ));
    } else {
      // Like
      await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, is_liked: true, likes_count: (p.likes_count || 0) + 1 }
          : p
      ));
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return {
    posts,
    loading,
    createPost,
    deletePost,
    likePost,
    refreshPosts: fetchPosts,
  };
};

export const usePostComments = (postId: string) => {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    
    if (data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      setComments(data.map(c => ({ ...c, profile: profileMap.get(c.user_id) as Profile })));
    }
    setLoading(false);
  }, [postId]);

  const addComment = async (content: string) => {
    if (!user || !content.trim()) return { error: 'Invalid' };
    
    const { error } = await supabase.from('post_comments').insert({
      post_id: postId,
      user_id: user.id,
      content: content.trim(),
    });
    
    if (!error) {
      await fetchComments();
    }
    return { error };
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
    if (!error) {
      setComments(prev => prev.filter(c => c.id !== commentId));
    }
    return { error };
  };

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  return { comments, loading, addComment, deleteComment, refreshComments: fetchComments };
};
