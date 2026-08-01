import { ChevronRightIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { ErrorState } from '@/components/error-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentUser } from '@/features/auth/auth-provider';
import { MembersPanel } from '@/features/projects/members-panel';
import { ProjectFormDialog } from '@/features/projects/project-form-dialog';
import { useDeleteProject, useProject, useProjectMembers } from '@/features/projects/hooks';
import {
  parseTaskFilters,
  taskFiltersToSearchParams,
  withFilterChange,
  type TaskFilters,
} from '@/features/tasks/filters';
import { TaskFiltersBar } from '@/features/tasks/task-filters-bar';
import { TaskFormDialog } from '@/features/tasks/task-form-dialog';
import { useTasks } from '@/features/tasks/hooks';
import { TaskList } from '@/features/tasks/task-list';
import { hasActiveFilters } from '@/features/tasks/filters';
import { DEFAULT_PAGE_SIZE, clampPage } from '@/lib/pagination';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) throw new Error('ProjectDetailPage rendered without a projectId param');

  const user = useCurrentUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const projectQuery = useProject(projectId);
  const membersQuery = useProjectMembers(projectId);
  const deleteProject = useDeleteProject();

  const filters = useMemo(() => parseTaskFilters(searchParams), [searchParams]);
  const tasksQuery = useTasks(projectId, filters);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  function handleFilterChange(change: Partial<TaskFilters>) {
    setSearchParams(taskFiltersToSearchParams(withFilterChange(filters, change)));
  }

  function handlePageChange(page: number) {
    setSearchParams(taskFiltersToSearchParams({ ...filters, page }));
  }

  if (projectQuery.isError) {
    return (
      <ErrorState
        error={projectQuery.error}
        onRetry={() => void projectQuery.refetch()}
        title="Could not load this project"
      />
    );
  }

  if (projectQuery.isPending) {
    return <ProjectDetailSkeleton />;
  }

  const project = projectQuery.data;
  const isOwner = project.owner_id === user.id;
  const members = (membersQuery.data ?? []).map((member) => member.profile);
  const tasksPage = tasksQuery.data;
  const safePage = tasksPage ? clampPage(filters.page, tasksPage.pageCount) : filters.page;

  return (
    <>
      <PageHeader
        breadcrumb={
          <nav className="text-muted-foreground flex items-center gap-1 text-sm">
            <Link to="/projects" className="hover:text-foreground">
              Projects
            </Link>
            <ChevronRightIcon className="size-3.5" aria-hidden />
            <span className="text-foreground truncate">{project.name}</span>
          </nav>
        }
        title={project.name}
        description={project.description || 'No description'}
        actions={
          isOwner ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                <PencilIcon className="size-4" aria-hidden />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash2Icon className="size-4" aria-hidden />
                Delete
              </Button>
            </>
          ) : undefined
        }
      />

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <TaskFiltersBar
              filters={filters}
              members={members}
              onChange={handleFilterChange}
            />
            <Button size="sm" onClick={() => setIsCreateTaskOpen(true)} className="shrink-0">
              <PlusIcon className="size-4" aria-hidden />
              New task
            </Button>
          </div>

          {tasksQuery.isError ? (
            <ErrorState error={tasksQuery.error} onRetry={() => void tasksQuery.refetch()} />
          ) : (
            <TaskList
              projectId={projectId}
              tasks={tasksPage?.items ?? []}
              isLoading={tasksQuery.isPending}
              isFetching={tasksQuery.isFetching}
              hasActiveFilters={hasActiveFilters(filters)}
              pagination={{
                page: safePage,
                pageSize: DEFAULT_PAGE_SIZE,
                total: tasksPage?.total ?? 0,
                pageCount: tasksPage?.pageCount ?? 1,
                onPageChange: handlePageChange,
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="members">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="text-base">Project members</CardTitle>
            </CardHeader>
            <CardContent>
              <MembersPanel
                projectId={projectId}
                isOwner={isOwner}
                currentUserId={user.id}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProjectFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        project={project}
      />

      <TaskFormDialog
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
        projectId={projectId}
        members={members}
      />

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete project?"
        description={`This permanently deletes "${project.name}" and all of its tasks and comments. This cannot be undone.`}
        onConfirm={async () => {
          await deleteProject.mutateAsync(projectId);
          toast.success('Project deleted');
          void navigate('/projects', { replace: true });
        }}
      />
    </>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-9 w-48" />
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
