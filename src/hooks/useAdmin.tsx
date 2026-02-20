import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile, Post, Report, BannedIP, AdminLog, UserRole } from '@/types/database';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export const useAdmin = () => {
  const [users, setUsers] = useState<(Profile & { role?: UserRole })[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [bannedIPs, setBannedIPs] = useState<BannedIP[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const fetchAllData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    
    const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    
    if (profilesData) {
      const usersWithRoles = await Promise.all(
        profilesData.map(async (profile: any) => {
          const { data: roleData } = await supabase.from('user_roles').select('*').eq('user_id', profile.id).single();
          return { ...profile, role: roleData as UserRole };
        })
      );
      setUsers(usersWithRoles as any[]);
    }
    
    const { data: postsData } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (postsData) {
      const userIds = [...new Set((postsData as any[]).map(p => p.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
      const profileMap = new Map((profiles as any[])?.map(p => [p.id, p]) || []);
      setPosts((postsData as any[]).map(p => ({ ...p, profile: profileMap.get(p.user_id) as Profile })));
    }
    
    const { data: reportsData } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (reportsData) {
      const rd = reportsData as any[];
      const userIds = [...new Set([...rd.map(r => r.reporter_id), ...rd.map(r => r.reported_user_id)])];
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
      const profileMap = new Map((profiles as any[])?.map(p => [p.id, p]) || []);
      setReports(rd.map(r => ({ ...r, reporter: profileMap.get(r.reporter_id) as Profile, reported_user: profileMap.get(r.reported_user_id) as Profile })) as Report[]);
    }
    
    const { data: bannedData } = await supabase.from('banned_ips').select('*').order('created_at', { ascending: false });
    setBannedIPs((bannedData as any as BannedIP[]) || []);
    
    const { data: logsData } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (logsData) {
      const ld = logsData as any[];
      const adminIds = [...new Set(ld.map(l => l.admin_id).filter(Boolean))];
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', adminIds as string[]);
      const profileMap = new Map((profiles as any[])?.map(p => [p.id, p]) || []);
      setAdminLogs(ld.map(l => ({ ...l, admin: l.admin_id ? profileMap.get(l.admin_id) as Profile : undefined })) as AdminLog[]);
    }
    
    setLoading(false);
  }, [isAdmin]);

  const logAdminAction = async (action: string, targetType: string, targetId?: string, details?: Record<string, any>) => {
    if (!user) return;
    await supabase.from('admin_logs').insert({ admin_id: user.id, action, target_type: targetType, target_id: targetId, details } as any);
  };

  const deleteUser = async (userId: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) { toast({ title: 'Lỗi', description: 'Không thể xóa tài khoản', variant: 'destructive' }); return { error }; }
    await logAdminAction('delete_user', 'user', userId);
    await fetchAllData();
    toast({ title: 'Thành công', description: 'Đã xóa tài khoản' });
    return { error: null };
  };

  const deletePost = async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) { toast({ title: 'Lỗi', description: 'Không thể xóa bài viết', variant: 'destructive' }); return { error }; }
    await logAdminAction('delete_post', 'post', postId);
    await fetchAllData();
    toast({ title: 'Thành công', description: 'Đã xóa bài viết' });
    return { error: null };
  };

  const banIP = async (ipAddress: string, reason?: string) => {
    const { error } = await supabase.from('banned_ips').insert({ ip_address: ipAddress, reason, banned_by: user?.id } as any);
    if (error) { toast({ title: 'Lỗi', description: 'Không thể chặn IP', variant: 'destructive' }); return { error }; }
    await logAdminAction('ban_ip', 'ip', undefined, { ip_address: ipAddress, reason });
    await fetchAllData();
    toast({ title: 'Thành công', description: 'Đã chặn IP' });
    return { error: null };
  };

  const unbanIP = async (ipId: string, ipAddress: string) => {
    const { error } = await supabase.from('banned_ips').delete().eq('id', ipId);
    if (error) { toast({ title: 'Lỗi', description: 'Không thể bỏ chặn IP', variant: 'destructive' }); return { error }; }
    await logAdminAction('unban_ip', 'ip', undefined, { ip_address: ipAddress });
    await fetchAllData();
    toast({ title: 'Thành công', description: 'Đã bỏ chặn IP' });
    return { error: null };
  };

  const updateReportStatus = async (reportId: string, status: string, adminNotes?: string) => {
    const { error } = await supabase.from('reports').update({ status, admin_notes: adminNotes } as any).eq('id', reportId);
    if (error) { toast({ title: 'Lỗi', description: 'Không thể cập nhật báo cáo', variant: 'destructive' }); return { error }; }
    await logAdminAction('update_report', 'report', reportId, { status, admin_notes: adminNotes });
    await fetchAllData();
    toast({ title: 'Thành công', description: 'Đã cập nhật báo cáo' });
    return { error: null };
  };

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  return { users, posts, reports, bannedIPs, adminLogs, loading, deleteUser, deletePost, banIP, unbanIP, updateReportStatus, refreshData: fetchAllData };
};
