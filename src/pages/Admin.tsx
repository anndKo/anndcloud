import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Users, FileText, Flag, Ban, Activity, Trash2, Eye, AlertTriangle, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Layout } from '@/components/layout/Layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';

export default function Admin() {
  const { isAdmin, loading: authLoading } = useAuth();
  const {
    users,
    posts,
    reports,
    bannedIPs,
    adminLogs,
    loading,
    deleteUser,
    deletePost,
    banIP,
    unbanIP,
    updateReportStatus,
  } = useAdmin();

  const [banIPDialog, setBanIPDialog] = useState(false);
  const [banIPInput, setBanIPInput] = useState('');
  const [banReason, setBanReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'user' | 'post'; id: string } | null>(null);

  if (authLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleBanIP = async () => {
    if (!banIPInput.trim()) return;
    await banIP(banIPInput, banReason || undefined);
    setBanIPDialog(false);
    setBanIPInput('');
    setBanReason('');
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    
    if (confirmDelete.type === 'user') {
      await deleteUser(confirmDelete.id);
    } else {
      await deletePost(confirmDelete.id);
    }
    setConfirmDelete(null);
  };

  const stats = [
    { label: 'Người dùng', value: users.length, icon: Users, color: 'text-blue-500' },
    { label: 'Bài viết', value: posts.length, icon: FileText, color: 'text-green-500' },
    { label: 'Báo cáo chờ xử lý', value: reports.filter(r => r.status === 'pending').length, icon: Flag, color: 'text-yellow-500' },
    { label: 'IP bị chặn', value: bannedIPs.length, icon: Ban, color: 'text-red-500' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Bảng điều khiển Admin</h1>
          <Button onClick={() => setBanIPDialog(true)} variant="destructive" className="gap-2">
            <Ban className="w-4 h-4" />
            Chặn IP
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="glass-card">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-secondary ${stat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="users">
          <TabsList className="mb-6">
            <TabsTrigger value="users">Người dùng</TabsTrigger>
            <TabsTrigger value="posts">Bài viết</TabsTrigger>
            <TabsTrigger value="reports">
              Báo cáo
              {reports.filter(r => r.status === 'pending').length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {reports.filter(r => r.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="banned">IP bị chặn</TabsTrigger>
            <TabsTrigger value="logs">Lịch sử</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Quản lý người dùng</CardTitle>
                <CardDescription>Xem và quản lý tất cả người dùng</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Người dùng</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Search ID</TableHead>
                        <TableHead>Vai trò</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Ngày tạo</TableHead>
                        <TableHead>Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={user.avatar_url || ''} />
                                <AvatarFallback>
                                  {user.display_name?.[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {user.display_name}
                            </div>
                          </TableCell>
                          <TableCell>@{user.username}</TableCell>
                          <TableCell className="text-xs">{user.search_id}</TableCell>
                          <TableCell>
                            <Badge variant={user.role?.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role?.role || 'user'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{user.registration_ip || 'N/A'}</TableCell>
                          <TableCell className="text-xs">
                            {formatDistanceToNow(new Date(user.created_at), { addSuffix: true, locale: vi })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {user.registration_ip && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setBanIPInput(user.registration_ip || '');
                                    setBanIPDialog(true);
                                  }}
                                >
                                  <Ban className="w-3 h-3" />
                                </Button>
                              )}
                              {user.role?.role !== 'admin' && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setConfirmDelete({ type: 'user', id: user.id })}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Quản lý bài viết</CardTitle>
                <CardDescription>Xem và xóa bài viết vi phạm</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div className="space-y-4">
                    {posts.slice(0, 20).map((post) => (
                      <div key={post.id} className="flex gap-4 p-4 bg-secondary/30 rounded-xl">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={post.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            {post.profile?.display_name?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{post.profile?.display_name}</span>
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: vi })}
                            </span>
                          </div>
                          <p className="text-sm">{post.content}</p>
                          {post.image_url && (
                            <img src={post.image_url} alt="" className="mt-2 max-h-32 rounded-lg" />
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setConfirmDelete({ type: 'post', id: post.id })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Báo cáo vi phạm</CardTitle>
                <CardDescription>Xem xét và xử lý các báo cáo</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : reports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Không có báo cáo nào</p>
                ) : (
                  <div className="space-y-4">
                    {reports.map((report) => (
                      <div key={report.id} className="p-4 bg-secondary/30 rounded-xl space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge variant={
                              report.status === 'pending' ? 'destructive' :
                              report.status === 'reviewed' ? 'default' : 'secondary'
                            }>
                              {report.status === 'pending' ? 'Chờ xử lý' :
                               report.status === 'reviewed' ? 'Đang xem xét' : 'Đã xử lý'}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: vi })}
                            </p>
                          </div>
                          {report.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateReportStatus(report.id, 'reviewed')}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Xem xét
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => updateReportStatus(report.id, 'resolved')}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Xử lý xong
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Người báo cáo:</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={report.reporter?.avatar_url || ''} />
                                <AvatarFallback className="text-xs">
                                  {report.reporter?.display_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{report.reporter?.display_name}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Người bị báo cáo:</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={report.reported_user?.avatar_url || ''} />
                                <AvatarFallback className="text-xs">
                                  {report.reported_user?.display_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{report.reported_user?.display_name}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm text-muted-foreground">Lý do:</p>
                          <p className="font-medium">{report.reason}</p>
                          {report.description && (
                            <p className="text-sm mt-1">{report.description}</p>
                          )}
                        </div>
                        
                        {report.evidence_url && (
                          <div>
                            <p className="text-sm text-muted-foreground">Bằng chứng:</p>
                            <img src={report.evidence_url} alt="Evidence" className="mt-1 max-h-48 rounded-lg" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Banned IPs Tab */}
          <TabsContent value="banned">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>IP bị chặn</CardTitle>
                <CardDescription>Quản lý danh sách IP bị chặn</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : bannedIPs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Chưa có IP nào bị chặn</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Lý do</TableHead>
                        <TableHead>Ngày chặn</TableHead>
                        <TableHead>Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bannedIPs.map((ip) => (
                        <TableRow key={ip.id}>
                          <TableCell className="font-mono">{ip.ip_address}</TableCell>
                          <TableCell>{ip.reason || 'N/A'}</TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(ip.created_at), { addSuffix: true, locale: vi })}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unbanIP(ip.id, ip.ip_address)}
                            >
                              Bỏ chặn
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Lịch sử hoạt động</CardTitle>
                <CardDescription>Xem các hành động của admin</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : adminLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Chưa có hoạt động nào</p>
                ) : (
                  <div className="space-y-3">
                    {adminLogs.map((log) => (
                      <div key={log.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium">{log.admin?.display_name || 'Admin'}</span>
                            {' '}{log.action}{' '}
                            <span className="text-muted-foreground">({log.target_type})</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: vi })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Ban IP Dialog */}
        <Dialog open={banIPDialog} onOpenChange={setBanIPDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chặn IP</DialogTitle>
              <DialogDescription>
                Người dùng từ IP này sẽ không thể đăng ký hoặc đăng nhập
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Địa chỉ IP</label>
                <Input
                  value={banIPInput}
                  onChange={(e) => setBanIPInput(e.target.value)}
                  placeholder="192.168.1.1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Lý do (tùy chọn)</label>
                <Input
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Spam, vi phạm, v.v."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBanIPDialog(false)}>
                Hủy
              </Button>
              <Button variant="destructive" onClick={handleBanIP}>
                Chặn IP
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Delete Dialog */}
        <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Xác nhận xóa
              </DialogTitle>
              <DialogDescription>
                Bạn có chắc chắn muốn xóa {confirmDelete?.type === 'user' ? 'tài khoản' : 'bài viết'} này?
                Hành động này không thể hoàn tác.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                Hủy
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                Xóa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
