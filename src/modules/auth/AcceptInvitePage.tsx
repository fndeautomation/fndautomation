import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../hooks/use-toast';
import FNDLoader from '../../components/shared/FNDLoader';

const schema = z
  .object({
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

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [inviteReady, setInviteReady] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    // Supabase auto-handles the hash fragment and signs in the user
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_IN' && session) {
          setInviteReady(true);
          setChecking(false);
        } else if (event === 'INITIAL_SESSION' && !session) {
          // No session from invite link — redirect to login
          navigate('/login', { replace: true });
        } else if (!session) {
          setChecking(false);
          navigate('/login', { replace: true });
        }
      })();
    });

    const timeout = setTimeout(() => {
      setChecking(false);
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    const { data: updateData, error } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (error || !updateData.user) {
      toast({ title: 'Error', description: error?.message ?? 'Failed to set password', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Update profile status to active
    await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', updateData.user.id);

    setLoading(false);
    setDone(true);

    setTimeout(() => navigate('/', { replace: true }), 1500);
  };

  if (checking) return <FNDLoader />;

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
            <h2 className="text-xl font-bold">Account activated!</h2>
            <p className="text-muted-foreground text-sm">Redirecting you to your dashboard…</p>
          </div>
        ) : !inviteReady ? (
          <div className="text-center space-y-3">
            <p className="text-muted-foreground text-sm">Validating your invite link…</p>
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-1">Set your password</h2>
            <p className="text-muted-foreground text-sm mb-8">
              Create a secure password to activate your FND account.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
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
                {errors.password && (
                  <p className="text-destructive text-xs">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    {...register('confirmPassword')}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activate Account
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
