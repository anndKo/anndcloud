import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Cloud, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
const authSchema = z.object({
  email: z.string().trim().email({
    message: 'Email không hợp lệ'
  }).max(255),
  password: z.string().min(6, {
    message: 'Mật khẩu phải có ít nhất 6 ký tự'
  }).max(100)
});
interface AuthFormProps {
  mode: 'login' | 'register';
}
export function AuthForm({
  mode
}: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const {
    signIn,
    signUp
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const result = authSchema.safeParse({
      email,
      password
    });
    if (!result.success) {
      const fieldErrors: {
        email?: string;
        password?: string;
      } = {};
      result.error.errors.forEach(err => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        const {
          error
        } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              variant: 'destructive',
              title: 'Lỗi đăng ký',
              description: 'Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.'
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Lỗi đăng ký',
              description: error.message
            });
          }
        } else {
          toast({
            title: 'Đăng ký thành công!',
            description: 'Bạn có thể đăng nhập ngay bây giờ.'
          });
          navigate('/login');
        }
      } else {
        const {
          error
        } = await signIn(email, password);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Lỗi đăng nhập',
            description: 'Email hoặc mật khẩu không đúng.'
          });
        } else {
          navigate('/storage');
        }
      }
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <motion.div initial={{
      opacity: 0,
      y: 20
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      duration: 0.5
    }} className="w-full max-w-md">
        <div className="glass-card rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <motion.div initial={{
          scale: 0.8,
          opacity: 0
        }} animate={{
          scale: 1,
          opacity: 1
        }} transition={{
          delay: 0.1
        }} className="flex items-center justify-center gap-3 mb-8">
            <div className="gradient-primary p-3 rounded-xl">
              <Cloud className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-gradient">Annd Cloud</h1>
          </motion.div>

          {/* Title */}
          <motion.div initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          delay: 0.2
        }} className="text-center mb-6">
            <h2 className="text-xl font-display font-semibold text-foreground">
              {mode === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}
            </h2>
            <p className="text-muted-foreground mt-1">
              {mode === 'login' ? 'Chào mừng bạn quay lại!' : 'Tạo tài khoản để lưu trữ dữ liệu của bạn'}
            </p>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div initial={{
            opacity: 0,
            x: -10
          }} animate={{
            opacity: 1,
            x: 0
          }} transition={{
            delay: 0.3
          }} className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="pl-10 h-12" />
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </motion.div>

            <motion.div initial={{
            opacity: 0,
            x: -10
          }} animate={{
            opacity: 1,
            x: 0
          }} transition={{
            delay: 0.4
          }} className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Mật khẩu
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 h-12" />
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </motion.div>

            <motion.div initial={{
            opacity: 0,
            y: 10
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: 0.5
          }}>
              <Button type="submit" disabled={loading} className="w-full h-12 gradient-primary text-white font-medium shadow-lg hover:shadow-xl hover:shadow-primary/25 transition-all">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
                    {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>}
              </Button>
            </motion.div>
          </form>

          {/* Switch mode */}
          <motion.p initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          delay: 0.6
        }} className="text-center mt-6 text-sm text-muted-foreground">
            {mode === 'login' ? <>
                Chưa có tài khoản?{' '}
                <button onClick={() => navigate('/register')} className="text-primary font-medium hover:underline">
                  Đăng ký ngay
                </button>
              </> : <>
                Đã có tài khoản?{' '}
                <button onClick={() => navigate('/login')} className="text-primary font-medium hover:underline">
                  Đăng nhập
                </button>
              </>}
          </motion.p>
        </div>
      </motion.div>
    </div>;
}