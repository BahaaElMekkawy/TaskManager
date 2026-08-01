import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateProject, useUpdateProject } from '@/features/projects/hooks';
import {
  projectFormSchema,
  type ProjectFormInput,
} from '@/features/projects/schemas';
import { useCurrentUser } from '@/features/auth/auth-provider';
import { getErrorMessage } from '@/lib/errors';
import type { Project } from '@/types/database';

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present -> editing that project. Absent -> creating a new one. */
  project?: Project;
  onSaved?: (project: Project) => void;
}

const emptyValues: ProjectFormInput = { name: '', description: '' };

/**
 * Create/edit project dialog.
 *
 * One component handles both flows rather than two nearly-identical ones,
 * switching mutation and copy based on whether `project` is provided. The form
 * resets to the given project's values (or blank) each time the dialog opens,
 * so reopening "Edit" on a different row doesn't show stale data from the
 * previous edit.
 */
export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: ProjectFormDialogProps) {
  const user = useCurrentUser();
  const isEditing = Boolean(project);

  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      project
        ? { name: project.name, description: project.description ?? '' }
        : emptyValues,
    );
  }, [open, project, form]);

  const createProject = useCreateProject(user.id);
  const updateProject = useUpdateProject(project?.id ?? '');
  const isSubmitting = createProject.isPending || updateProject.isPending;

  async function onSubmit(input: ProjectFormInput) {
    const values = projectFormSchema.parse(input);

    try {
      const saved = project
        ? await updateProject.mutateAsync(values)
        : await createProject.mutateAsync(values);

      toast.success(isEditing ? 'Project updated' : 'Project created');
      onOpenChange(false);
      onSaved?.(saved);
    } catch (error) {
      form.setError('root', { message: getErrorMessage(error) });
    }
  }

  const rootError = form.formState.errors.root?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit project' : 'New project'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the name and description.'
              : 'Give your project a name and a short description.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {rootError ? (
              <p
                role="alert"
                className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
              >
                {rootError}
              </p>
            ) : null}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Website Redesign" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="What is this project about?"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : isEditing ? (
                  'Save changes'
                ) : (
                  'Create project'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
