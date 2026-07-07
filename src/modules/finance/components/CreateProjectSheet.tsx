import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import type { Profile } from '../../../types/database';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../../components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Progress } from '../../../components/ui/progress';
import { useToast } from '../../../hooks/use-toast';

function formatPKR(v: number) {
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(v);
}

const milestoneSchema = z.object({
  title: z.string().min(1, 'Title required'),
  percentage: z
    .number({ invalid_type_error: 'Enter a number' })
    .min(1, 'Must be > 0')
    .max(100, 'Must be ≤ 100'),
});

const schema = z.object({
  name: z.string().min(2, 'Project name required'),
  total_value: z.number({ invalid_type_error: 'Enter a value' }).positive('Must be positive'),
  assigned_to: z.string().min(1, 'Assign to a Director/PM'),
  milestones: z
    .array(milestoneSchema)
    .min(1, 'Add at least one milestone'),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateProjectSheet({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [directors, setDirectors] = useState<Profile[]>([]);

  const { register, handleSubmit, watch, setValue, control, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      milestones: [{ title: 'Milestone 1', percentage: 100 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'milestones' });
  const milestones = watch('milestones');
  const totalValue = watch('total_value') || 0;

  const lastMilestonePct = milestones?.length > 0 ? (Number(milestones[milestones.length - 1].percentage) || 0) : 0;
  const isIncreasing = milestones?.every((m, i) => {
    const val = Number(m.percentage) || 0;
    if (i === 0) return val > 0 && val <= 100;
    const prevVal = Number(milestones[i - 1].percentage) || 0;
    return val > prevVal && val <= 100;
  }) ?? true;

  const pctOk = isIncreasing && milestones?.length > 0;

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, label')
      .eq('role', 'director_pm')
      .eq('status', 'active')
      .then(({ data }) => setDirectors((data as Profile[]) ?? []));
  }, []);

  const onSubmit = async (data: FormData) => {
    if (!pctOk) {
      toast({
        title: 'Invalid milestones',
        description: 'Milestones must be in strictly increasing order (cumulative progress) and cannot exceed 100%.',
        variant: 'destructive',
      });
      return;
    }
    if (!user) return;
    setSaving(true);

    try {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: data.name,
          total_value: data.total_value,
          assigned_to: data.assigned_to,
          created_by: user.id,
          status: 'active',
        })
        .select()
        .single();

      if (projectError || !project) throw new Error(projectError?.message ?? 'Failed to create project');

      const milestonesToInsert = data.milestones.map((m, i) => {
        const prevPct = i === 0 ? 0 : data.milestones[i - 1].percentage;
        const incPct = m.percentage - prevPct;
        return {
          project_id: project.id,
          title: m.title,
          percentage: m.percentage,
          value: Math.round((data.total_value * incPct / 100) * 100) / 100,
          order_index: i,
          status: 'pending' as const,
        };
      });

      const { error: msError } = await supabase.from('milestones').insert(milestonesToInsert);
      if (msError) throw new Error(msError.message);

      // Notify the assigned Director/PM
      await supabase.from('notifications').insert({
        recipient_id: data.assigned_to,
        type: 'project_assigned',
        reference_id: project.id,
      });

      toast({ title: 'Project created!', description: `${project.short_id} — ${data.name}` });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create New Project</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Project name</Label>
              <Input placeholder="e.g. Block C MEP Installation" {...register('name')} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Total project value (PKR)</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 5000000"
                {...register('total_value', { valueAsNumber: true })}
              />
              {errors.total_value && <p className="text-destructive text-xs">{errors.total_value.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Assign to Director / PM</Label>
              <Select onValueChange={v => setValue('assigned_to', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a Director or PM…" />
                </SelectTrigger>
                <SelectContent>
                  {directors.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.full_name}
                      <span className="ml-1.5 text-muted-foreground text-xs">({d.label})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.assigned_to && <p className="text-destructive text-xs">{errors.assigned_to.message}</p>}
            </div>
          </div>

          {/* Milestones */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">Milestones</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ title: `Milestone ${fields.length + 1}`, percentage: 0 })}
              >
                <Plus size={14} className="mr-1" /> Add
              </Button>
            </div>

            {/* Progress bar */}
            <div className="mb-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Cumulative Target</span>
                <span className={pctOk ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>
                  {lastMilestonePct.toFixed(1)}% {!pctOk && '— Invalid sequence'}
                  {pctOk && ' ✓'}
                </span>
              </div>
              <Progress value={Math.min(lastMilestonePct, 100)} className="h-2" />
            </div>

            {!pctOk && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs mb-3">
                <AlertCircle size={13} />
                Milestones must be in strictly increasing order (cumulative progress) and cannot exceed 100%.
              </div>
            )}

            <div className="space-y-3">
              {fields.map((field, i) => {
                const pct = Number(milestones?.[i]?.percentage) || 0;
                const prevPct = i === 0 ? 0 : (Number(milestones?.[i - 1]?.percentage) || 0);
                const incPct = Math.max(0, pct - prevPct);
                const val = totalValue > 0 ? (totalValue * incPct / 100) : 0;
                return (
                  <div key={field.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder={`Milestone ${i + 1} title`}
                        {...register(`milestones.${i}.title`)}
                      />
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 flex-1">
                          <Input
                            type="number"
                            min="0.1"
                            max="100"
                            step="0.1"
                            placeholder="Cumulative %"
                            className="w-28"
                            {...register(`milestones.${i}.percentage`, { valueAsNumber: true })}
                          />
                          <span className="text-muted-foreground text-xs font-medium">Cumulative %</span>
                        </div>
                        {pct > 0 && (
                          <span className="text-xs text-muted-foreground font-mono">
                            = PKR {formatPKR(val)} (Share: {incPct.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive mt-0.5"
                        onClick={() => remove(i)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !pctOk}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
