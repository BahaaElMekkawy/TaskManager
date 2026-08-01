import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon, UserMinusIcon, UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addMemberSchema,
  type AddMemberInput,
} from '@/features/projects/schemas';
import {
  useAddProjectMember,
  useProjectMembers,
  useRemoveProjectMember,
} from '@/features/projects/hooks';
import { getErrorMessage } from '@/lib/errors';

function initialsOf(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '?').slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

/**
 * Members panel: list + owner-only invite form + owner-only removal.
 *
 * isOwner is passed in rather than recomputed here so this component stays a
 * pure presentation layer over whatever the caller already knows about the
 * viewer's role — the source of truth for "am I the owner" is the project
 * record the parent page already fetched.
 */
export function MembersPanel({
  projectId,
  isOwner,
  currentUserId,
}: {
  projectId: string;
  isOwner: boolean;
  currentUserId: string;
}) {
  const membersQuery = useProjectMembers(projectId);
  const addMember = useAddProjectMember(projectId);
  const removeMember = useRemoveProjectMember(projectId);
  const [memberToRemove, setMemberToRemove] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  const form = useForm<AddMemberInput>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: AddMemberInput) {
    try {
      await addMember.mutateAsync(values.email);
      toast.success(`Added ${values.email} to the project`);
      form.reset();
    } catch (error) {
      form.setError('root', { message: getErrorMessage(error) });
    }
  }

  if (membersQuery.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (membersQuery.isError) {
    return (
      <p className="text-muted-foreground text-sm">
        {getErrorMessage(membersQuery.error)}
      </p>
    );
  }

  const rootError = form.formState.errors.root?.message;

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {membersQuery.data.map((member) => (
          <li
            key={member.profile.id}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="text-xs">
                  {initialsOf(member.profile.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {member.profile.display_name}
                  {member.profile.id === currentUserId ? ' (you)' : ''}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {member.profile.email}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="text-muted-foreground text-xs capitalize">
                {member.role}
              </span>
              {isOwner && member.role !== 'owner' ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${member.profile.display_name}`}
                  onClick={() =>
                    setMemberToRemove({
                      userId: member.profile.id,
                      name: member.profile.display_name,
                    })
                  }
                >
                  <UserMinusIcon className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {isOwner ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2" noValidate>
            {rootError ? (
              <p role="alert" className="text-destructive text-xs">
                {rootError}
              </p>
            ) : null}

            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="teammate@example.com"
                        aria-label="Email address to invite"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting} size="icon">
                {form.formState.isSubmitting ? (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                ) : (
                  <UserPlusIcon className="size-4" aria-hidden />
                )}
                <span className="sr-only">Add member</span>
              </Button>
            </div>
          </form>
        </Form>
      ) : null}

      <ConfirmDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
        title="Remove member?"
        description={
          memberToRemove
            ? `${memberToRemove.name} will lose access to this project and its tasks.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!memberToRemove) return;
          await removeMember.mutateAsync(memberToRemove.userId);
          toast.success('Member removed');
        }}
      />
    </div>
  );
}
