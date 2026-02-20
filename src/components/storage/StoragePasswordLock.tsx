import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lock, Shield, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StoragePasswordLockProps {
  userId: string;
  isUnlocked: boolean;
  onUnlock: () => void;
  onSetupToggle?: () => void;
}

// Simple hash function for 6-digit PIN (client-side)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'storage-salt-v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function StoragePasswordSetup({ userId }: { userId: string }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    const { data } = await supabase
      .from('storage_passwords')
      .select('is_enabled')
      .eq('user_id', userId)
      .single() as any;
    setIsEnabled(!!data?.is_enabled);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      setShowSetupDialog(true);
    } else {
      // Disable password
      await supabase.from('storage_passwords').delete().eq('user_id', userId) as any;
      setIsEnabled(false);
      toast({ title: 'Đã tắt', description: 'Mật khẩu bảo vệ đã được tắt' });
    }
  };

  const handleSavePin = async () => {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      toast({ title: 'Lỗi', description: 'Mật khẩu phải gồm đúng 6 chữ số', variant: 'destructive' });
      return;
    }
    if (pin !== confirmPin) {
      toast({ title: 'Lỗi', description: 'Mật khẩu xác nhận không khớp', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const hashed = await hashPin(pin);

    // Upsert
    const { data: existing } = await supabase
      .from('storage_passwords')
      .select('id')
      .eq('user_id', userId)
      .single() as any;

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('storage_passwords')
        .update({ password_hash: hashed, is_enabled: true } as any)
        .eq('user_id', userId) as any);
    } else {
      ({ error } = await supabase
        .from('storage_passwords')
        .insert({ user_id: userId, password_hash: hashed, is_enabled: true } as any) as any);
    }

    setSaving(false);
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể lưu mật khẩu', variant: 'destructive' });
    } else {
      setIsEnabled(true);
      setShowSetupDialog(false);
      setPin('');
      setConfirmPin('');
      toast({ title: 'Thành công', description: 'Đã bật mật khẩu bảo vệ' });
    }
  };

  if (loading) return null;

  return (
    <>
      <div className="flex items-center gap-3">
        <Shield className="w-4 h-4 text-muted-foreground" />
        <Label htmlFor="storage-password-toggle" className="text-sm cursor-pointer">
          Mật khẩu bảo vệ
        </Label>
        <Switch
          id="storage-password-toggle"
          checked={isEnabled}
          onCheckedChange={handleToggle}
        />
        {isEnabled && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
      </div>

      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Đặt mật khẩu bảo vệ
            </DialogTitle>
            <DialogDescription>
              Nhập mật khẩu gồm 6 chữ số để bảo vệ kho lưu trữ của bạn
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Mật khẩu (6 số)</Label>
              <div className="relative">
                <Input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="text-center text-2xl tracking-[0.5em] pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Xác nhận mật khẩu</Label>
              <Input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="text-center text-2xl tracking-[0.5em]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSetupDialog(false); setPin(''); setConfirmPin(''); }}>
              Hủy
            </Button>
            <Button onClick={handleSavePin} disabled={saving || pin.length !== 6}>
              {saving ? 'Đang lưu...' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StoragePasswordGate({ userId, onUnlock }: { userId: string; onUnlock: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleVerify = async () => {
    if (pin.length !== 6) return;
    setChecking(true);
    setError('');

    try {
      // Verify through edge function (server-side check)
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/secure-storage-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ pin, action: 'files' }), // Just a test call
      });

      setChecking(false);

      if (response.ok) {
        onUnlock(pin);
      } else {
        setError('Mật khẩu không đúng');
        setPin('');
        toast({ title: 'Sai mật khẩu', description: 'Vui lòng thử lại', variant: 'destructive' });
      }
    } catch {
      setChecking(false);
      setError('Mật khẩu không đúng');
      setPin('');
      toast({ title: 'Sai mật khẩu', description: 'Vui lòng thử lại', variant: 'destructive' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 6) {
      handleVerify();
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-2xl max-w-sm w-full text-center space-y-6"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Kho lưu trữ được bảo vệ</h2>
          <p className="text-muted-foreground text-sm mt-1">Nhập mật khẩu 6 số để tiếp tục</p>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <Input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="••••••"
              className="text-center text-2xl tracking-[0.5em] pr-10"
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setShowPin(!showPin)}
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button onClick={handleVerify} disabled={checking || pin.length !== 6} className="w-full">
            {checking ? 'Đang kiểm tra...' : 'Mở khóa'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
