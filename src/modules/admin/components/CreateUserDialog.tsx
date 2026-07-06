import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus } from 'lucide-react';
import { supabase, SUPABASE_URL } from '../../../lib/supabase';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { useToast } from '../../../hooks/use-toast';

const ROLE_LABELS: Record<string, string[]> = {
  finance_officer: ['Lead Finance Officer', 'Finance Officer'],
  director_pm: ['Director', 'Project Manager'],
};

const schema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  role: z.enum(['finance_officer', 'director_pm']),
  label: z.string().min(1, 'Select a label'),
});
type FormData = z.infer<typeof schema>;

interface Props {
  onCreated: () => void;
}

export default function CreateUserDialog({ onCreated }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'finance_officer', label: '' },
  });

  const selectedRole = watch('role');
  const labelOptions = ROLE_LABELS[selectedRole] ?? [];

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) {
        toast({ title: 'Failed to invite user', description: json.error, variant: 'destructive' });
        setLoading(false);
        return;
      }

      toast({ title: 'Invite sent!', description: `${data.full_name} will receive an invite email.` });
      reset();
      setOpen(false);
      onCreated();
    } catch {
      toast({ title: 'Network error', description: 'Could not send the invite.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus size={15} className="mr-2" /> Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input placeholder="e.g. Zain Nanji" {...register('full_name')} />
            {errors.full_name && <p className="text-destructive text-xs">{errors.full_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Email address</Label>
            <Input type="email" placeholder="user@fnd.com" {...register('email')} />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(v) => {
                setValue('role', v as 'finance_officer' | 'director_pm');
                setValue('label', '');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="finance_officer">Finance Officer</SelectItem>
                <SelectItem value="director_pm">Director / Project Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Label</Label>
            <Select
              value={watch('label')}
              onValueChange={(v) => setValue('label', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a label…" />
              </SelectTrigger>
              <SelectContent>
                {labelOptions.map(l => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.label && <p className="text-destructive text-xs">{errors.label.message}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invite
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
