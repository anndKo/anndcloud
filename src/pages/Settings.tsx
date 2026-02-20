import { useState } from 'react';
import { Save } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', profile.id);
    
    setLoading(false);
    
    if (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật thông tin',
        variant: 'destructive',
      });
    } else {
      await refreshProfile();
      toast({
        title: 'Thành công',
        description: 'Đã cập nhật thông tin',
      });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Cài đặt</h1>
          
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Thông tin cá nhân</CardTitle>
              <CardDescription>Cập nhật thông tin hiển thị của bạn</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tên người dùng</Label>
                <Input value={profile?.username || ''} disabled />
                <p className="text-xs text-muted-foreground">Không thể thay đổi tên người dùng</p>
              </div>
              
              <div className="space-y-2">
                <Label>Tên hiển thị</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tên hiển thị"
                />
              </div>
              
              <div className="space-y-2">
                <Label>ID tìm kiếm</Label>
                <Input value={profile?.search_id || ''} disabled />
                <p className="text-xs text-muted-foreground">Người khác có thể tìm bạn bằng ID này</p>
              </div>
              
              <Button
                onClick={handleSave}
                disabled={loading}
                className="gradient-primary gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
