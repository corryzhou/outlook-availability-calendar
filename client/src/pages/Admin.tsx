import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, RefreshCw, Eye, EyeOff, Calendar, Shield } from "lucide-react";
import { trpc } from "@/lib/trpc";

const SESSION_KEY = "admin_token";

export default function Admin() {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Validate existing token on mount
  const { data: tokenValidation } = trpc.admin.validateToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false }
  );

  const isAuthenticated = !!token && tokenValidation?.valid === true;

  const verifyPassword = trpc.admin.verifyPassword.useMutation({
    onSuccess: (data) => {
      sessionStorage.setItem(SESSION_KEY, data.token);
      setToken(data.token);
      setLoginError(null);
      setPassword("");
    },
    onError: (err) => {
      setLoginError(err.message);
    },
  });

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    verifyPassword.mutate({ password });
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setToken(null);
  }

  // Calendar status
  const { data: statusData, isLoading: statusLoading, refetch } = trpc.calendar.status.useQuery(
    undefined,
    { enabled: isAuthenticated, retry: false }
  );

  // ── Login screen ─────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-sans mb-2">管理</p>
            <h1 className="text-4xl font-serif text-foreground">访问验证</h1>
            <p className="text-sm text-muted-foreground font-sans mt-2 tracking-wide">
              请输入管理员密码以继续
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="管理员密码"
                className="w-full h-11 px-4 pr-11 border border-border bg-card text-foreground font-sans text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {loginError && (
              <div className="flex items-center gap-2 text-[var(--busy)]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-sans">{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verifyPassword.isPending || !password.trim()}
              className="w-full h-11 bg-foreground text-background text-[10px] tracking-[0.15em] uppercase font-sans hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {verifyPassword.isPending ? "验证中…" : "进入管理"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border">
            <a href="/" className="text-[10px] tracking-[0.12em] uppercase font-sans text-muted-foreground hover:text-foreground transition-colors">
              ← 返回日历
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Admin dashboard ───────────────────────────────────────────────────────────
  const connected = statusData?.connected ?? false;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container py-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-sans">管理</p>
              <h1 className="text-4xl font-serif mt-1">日历状态</h1>
            </div>
            <div className="flex items-center gap-6">
              <a href="/" className="text-[10px] tracking-[0.12em] uppercase font-sans text-muted-foreground hover:text-foreground transition-colors">
                ← 返回日历
              </a>
              <button onClick={handleLogout} className="text-[10px] tracking-[0.12em] uppercase font-sans text-muted-foreground hover:text-foreground transition-colors">
                退出
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-10">
        <div className="max-w-lg space-y-8">

          {/* Connection status */}
          <div className="border border-border p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-xs tracking-[0.12em] uppercase font-sans text-muted-foreground">
                  Outlook iCal 连接状态
                </h2>
              </div>
              <button
                onClick={() => refetch()}
                className="w-6 h-6 flex items-center justify-center hover:bg-accent transition-colors rounded"
                aria-label="刷新状态"
              >
                <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {statusLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
                <span className="text-sm font-sans text-muted-foreground">检查中…</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: connected ? "var(--free)" : "var(--busy)" }} />
                <span className="text-sm font-sans text-foreground font-medium">
                  {connected ? "已连接 — 日历数据正常读取中" : "未连接 — ICAL_URL 未配置"}
                </span>
              </div>
            )}

            {connected && (
              <div className="flex items-start gap-2 p-3 bg-[var(--free-light)] border border-[var(--free)]">
                <CheckCircle className="w-3.5 h-3.5 text-[var(--free)] mt-0.5 shrink-0" />
                <p className="text-xs font-sans text-foreground leading-relaxed">
                  日历已连接。访问者可以看到你的时间可用性，但看不到任何具体事项内容。
                </p>
              </div>
            )}

            {!connected && (
              <div className="flex items-start gap-2 p-3 bg-[var(--busy-light)] border border-[var(--busy)]">
                <AlertCircle className="w-3.5 h-3.5 text-[var(--busy)] mt-0.5 shrink-0" />
                <div className="text-xs font-sans text-foreground leading-relaxed space-y-1">
                  <p>请在 <strong>Settings → Secrets</strong> 中配置 <code className="font-mono bg-muted px-1">ICAL_URL</code> 环境变量。</p>
                  <p>从 Outlook 网页版日历 → 日历设置 → 发布日历，复制 ICS 链接粘贴进去即可。</p>
                </div>
              </div>
            )}
          </div>

          {/* Privacy info */}
          <div className="border border-border p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-xs tracking-[0.12em] uppercase font-sans text-muted-foreground">
                隐私保护说明
              </h2>
            </div>
            <div className="space-y-2 text-xs font-sans text-muted-foreground leading-relaxed">
              <p>后端读取 iCal 数据后，仅提取每个事件的开始和结束时间，用于计算每小时的忙碌/空闲状态。</p>
              <p>事件标题、描述、参与者、地点等所有内容均被丢弃，从不存储，也从不发送到前端。</p>
              <p>访问者通过公开 API 只能获取布尔值（忙/闲），无法获取任何其他信息。</p>
            </div>
          </div>

          {/* How to update iCal */}
          <div className="border-t border-border pt-6">
            <h3 className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans mb-3">
              如何更新 iCal 链接
            </h3>
            <p className="text-xs font-sans text-muted-foreground leading-relaxed">
              如果 iCal 链接失效，前往 Outlook 网页版 → 日历 → 左侧"日历"三点菜单 → 设置 → 发布日历，重新复制 ICS 链接，然后在 <strong>Settings → Secrets</strong> 中更新 <code className="font-mono bg-muted px-1">ICAL_URL</code> 的值。
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
