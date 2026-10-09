import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Bike, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";

const BG = "https://images.unsplash.com/photo-1636761358757-0a616eb9e17e?crop=entropy&cs=srgb&fm=jpg&q=80&w=1600";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await login(email, password); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:block relative">
        <img src={BG} alt="Motorcycle workshop" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <div className="label-xs !text-amber-400 mb-3">Motorcycle Spare Parts</div>
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-tight">Billing, stock & ledger.<br />One counter, every device.</h1>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 tactical-grid">
        <form onSubmit={submit} className="w-full max-w-sm bg-card border rounded-lg p-8 shadow-xl fade-up" data-testid="login-form">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-md bg-primary text-primary-foreground grid place-items-center"><Bike className="h-6 w-6" /></div>
            <div><div className="font-heading text-2xl font-extrabold">MotoPOS</div><div className="label-xs">Sign in to continue</div></div>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Email</Label>
              <Input data-testid="login-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Password</Label>
              <Input data-testid="login-password-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {err && <div className="text-sm text-destructive" data-testid="login-error">{err}</div>}
            <Button data-testid="login-submit-btn" type="submit" className="w-full h-11 font-semibold" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Sign In
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
