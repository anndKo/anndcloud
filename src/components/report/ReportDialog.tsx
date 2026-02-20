import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam hoặc lừa đảo' },
  { id: 'harassment', label: 'Quấy rối hoặc bắt nạt' },
  { id: 'hate', label: 'Ngôn ngữ thù địch' },
  { id: 'violence', label: 'Bạo lực hoặc đe dọa' },
  { id: 'inappropriate', label: 'Nội dung không phù hợp' },
  { id: 'fake', label: 'Tài khoản giả mạo' },
  { id: 'other', label: 'Lý do khác' },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportedUserId: string;
  reportedUserName: string;
}

export const ReportDialog = ({
  open,
  onOpenChange,
  reportedUserId,
  reportedUserName,
}: ReportDialogProps) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleEvidenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEvidence(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEvidencePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeEvidence = () => {
    setEvidence(null);
    setEvidencePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!reason || !user) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn lý do báo cáo',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    let evidenceUrl = null;
    if (evidence) {
      const path = `${user.id}/${Date.now()}-${evidence.name}`;
      evidenceUrl = await uploadFile('report-evidence', path, evidence);
    }

    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      reason: REPORT_REASONS.find(r => r.id === reason)?.label || reason,
      description,
      evidence_url: evidenceUrl,
    } as any);

    setLoading(false);

    if (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi báo cáo',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Thành công',
        description: 'Báo cáo đã được gửi đến quản trị viên',
      });
      onOpenChange(false);
      setReason('');
      setDescription('');
      removeEvidence();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Báo cáo người dùng</DialogTitle>
          <DialogDescription>
            Báo cáo <span className="font-medium">{reportedUserName}</span> cho quản trị viên
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Lý do báo cáo</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {REPORT_REASONS.map((r) => (
                <div key={r.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.id} id={r.id} />
                  <Label htmlFor={r.id} className="cursor-pointer font-normal">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Mô tả chi tiết (tùy chọn)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả thêm về vấn đề..."
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Bằng chứng (tùy chọn)</Label>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleEvidenceSelect}
            />
            {evidencePreview ? (
              <div className="relative inline-block">
                <img
                  src={evidencePreview}
                  alt="Evidence"
                  className="max-h-32 rounded-lg object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={removeEvidence}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-2"
              >
                <Upload className="w-4 h-4" />
                Tải lên hình ảnh
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !reason}
            className="gradient-primary"
          >
            Gửi báo cáo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
