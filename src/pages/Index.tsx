import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cloud, ArrowRight, Shield, Zap, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
export default function Index() {
  const {
    user,
    loading
  } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) {
      navigate('/storage');
    }
  }, [user, loading, navigate]);
  if (loading) {
    return <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>;
  }
  return <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.header initial={{
        y: -20,
        opacity: 0
      }} animate={{
        y: 0,
        opacity: 1
      }} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="gradient-primary p-2 rounded-xl">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-display font-bold text-gradient">Annd Cloud</span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/login')} className="font-medium">
              Đăng nhập
            </Button>
            <Button onClick={() => navigate('/register')} className="gradient-primary text-white font-medium shadow-lg hover:shadow-xl hover:shadow-primary/25">
              Đăng ký
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.header>

        {/* Hero */}
        <main className="mt-20 lg:mt-32">
          <motion.div initial={{
          opacity: 0,
          y: 30
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.1
        }} className="text-center max-w-3xl mx-auto">
            <motion.div initial={{
            scale: 0.8,
            opacity: 0
          }} animate={{
            scale: 1,
            opacity: 1
          }} transition={{
            delay: 0.2
          }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Lưu trữ dữ liệu cá nhân an toàn
            </motion.div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight">
              Lưu trữ mọi thứ
              <br />
              <span className="text-gradient">Một cách đơn giản</span>
            </h1>

            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              CloudVault giúp bạn lưu trữ ảnh, video, file và link một cách an toàn. 
              Hỗ trợ file lên đến 20GB, đồng bộ mượt mà và bảo mật tuyệt đối.
            </p>

            <motion.div initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: 0.4
          }} className="mt-10 flex flex-wrap justify-center gap-4">
              <Button onClick={() => navigate('/register')} size="lg" className="gradient-primary text-white font-medium text-lg px-8 shadow-glow hover:shadow-glow-lg transition-all">
                Bắt đầu miễn phí
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/login')} className="font-medium text-lg px-8">
                Đã có tài khoản?
              </Button>
            </motion.div>
          </motion.div>

          {/* Features */}
          <motion.div initial={{
          opacity: 0,
          y: 40
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.6
        }} className="mt-24 grid md:grid-cols-3 gap-6">
            <div className="glass-card rounded-2xl p-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/20 text-green-600 mb-4">
                <Shield className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground">
                Bảo mật cao
              </h3>
              <p className="mt-2 text-muted-foreground">
                Dữ liệu của bạn được mã hóa và bảo vệ tuyệt đối
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 text-primary mb-4">
                <HardDrive className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground">
                Dung lượng lớn
              </h3>
              <p className="mt-2 text-muted-foreground">
                Hỗ trợ upload file lên đến 20GB mỗi file
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/20 text-accent mb-4">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground">
                Nhanh chóng
              </h3>
              <p className="mt-2 text-muted-foreground">
                Upload mượt mà với thanh tiến trình realtime
              </p>
            </div>
          </motion.div>
        </main>
      </div>
    </div>;
}