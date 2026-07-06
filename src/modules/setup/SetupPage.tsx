import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../hooks/use-toast';

const schema = z
  .object({
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/\d/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine(d => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function SetupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/setup-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          full_name: data.full_name,
          email: data.email,
          password: data.password,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast({ title: 'Setup failed', description: json.error, variant: 'destructive' });
        setLoading(false);
        return;
      }

      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch {
      toast({ title: 'Network error', description: 'Could not reach the server.', variant: 'destructive' });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fnd-fade-in">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img
            src="/assets/images/Gemini_Generated_Image_dx05judx05judx05.png"
            alt="FND"
            className="h-10 w-10 object-contain"
          />
          <span className="text-xl font-bold text-primary">FND</span>
        </div>

        {done ? (
          <div className="text-center space-y-3">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">Admin account created!</h2>
            <p className="text-muted-foreground text-sm">Redirecting you to sign in…</p>
          </div>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-800">
              <strong>First-time setup.</strong> No admin account exists yet. Create one to get started.
            </div>

            <h2 className="text-2xl font-bold mb-1">Create admin account</h2>
            <p className="text-muted-foreground text-sm mb-6">
              This page is only accessible when no admin exists.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input placeholder="e.g. Ahmed Fahim" {...register('full_name')} />
                {errors.full_name && <p className="text-destructive text-xs">{errors.full_name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Email address</Label>
                <Input type="email" placeholder="admin@fnd.com" {...register('email')} />
                {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min 8 chars, at least 1 number"
                    {...register('password')}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Confirm password</Label>
                <Input type="password" placeholder="Re-enter password" {...register('confirmPassword')} />
                {errors.confirmPassword && <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create admin account
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
