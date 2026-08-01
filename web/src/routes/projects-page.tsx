import { FolderKanbanIcon, PlusIcon, SearchIcon, UsersIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { PageHeader } from '@/components/page-header';
import { PaginationControls } from '@/components/pagination-controls';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/auth-provider';
import { ProjectFormDialog } from '@/features/projects/project-form-dialog';
import { useProjects } from '@/features/projects/hooks';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { DEFAULT_PAGE_SIZE, clampPage } from '@/lib/pagination';

export function ProjectsPage() {
  const user = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const page = Number(searchParams.get('page') ?? '1');
  const searchInput = searchParams.get('q') ?? '';

  const projectsQuery = useProjects(Math.max(1, page), searchInput);

  function updateParams(next: { q?: string; page?: number }) {
    const params = new URLSearchParams(searchParams);
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q);
      else params.delete('q');
      params.delete('page');
    }
    if (next.page !== undefined) {
      if (next.page > 1) params.set('page', String(next.page));
      else params.delete('page');
    }
    setSearchParams(params);
  }

  const projects = projectsQuery.data;
  const safePage = projects ? clampPage(page, projects.pageCount) : page;

  // Controlled, but only synced from the URL when the URL changed for a
  // reason other than our own debounced update (e.g. browser back/forward).
  // A naive controlled input tied straight to searchParams would fight the
  // user mid-keystroke, since the URL update lags behind typing by design.
  const [searchText, setSearchText] = useState(searchInput);
  const lastEmittedSearch = useRef(searchInput);

  useEffect(() => {
    if (searchInput !== lastEmittedSearch.current) {
      lastEmittedSearch.current = searchInput;
      setSearchText(searchInput);
    }
  }, [searchInput]);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    lastEmittedSearch.current = value;
    updateParams({ q: value });
  }, 300);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Everything you own or collaborate on."
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <PlusIcon className="size-4" aria-hidden />
            New project
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <SearchIcon
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search projects…"
          value={searchText}
          className="pl-9"
          aria-label="Search projects"
          onChange={(event) => {
            setSearchText(event.target.value);
            debouncedSearch(event.target.value);
          }}
        />
      </div>

      {projectsQuery.isError ? (
        <ErrorState error={projectsQuery.error} onRetry={() => void projectsQuery.refetch()} />
      ) : !projects ? (
        <ProjectGridSkeleton />
      ) : projects.items.length === 0 ? (
        searchInput ? (
          <EmptyState
            icon={SearchIcon}
            title="No projects match your search"
            description="Try a different search term."
          />
        ) : (
          <EmptyState
            icon={FolderKanbanIcon}
            title="No projects yet"
            description="Create your first project to start tracking tasks."
            action={
              <Button onClick={() => setIsCreateOpen(true)}>
                <PlusIcon className="size-4" aria-hidden />
                New project
              </Button>
            }
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.items.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`} className="block">
                <Card className="hover:border-ring h-full gap-3 p-5 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-medium">{project.name}</h3>
                    {project.owner_id === user.id ? (
                      <span className="bg-secondary text-secondary-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                        Owner
                      </span>
                    ) : null}
                  </div>

                  <p className="text-muted-foreground line-clamp-2 min-h-10 text-sm">
                    {project.description || 'No description'}
                  </p>

                  <div className="text-muted-foreground flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <FolderKanbanIcon className="size-3.5" aria-hidden />
                      {project.taskCount} {project.taskCount === 1 ? 'task' : 'tasks'}
                    </span>
                    <span className="flex items-center gap-1">
                      <UsersIcon className="size-3.5" aria-hidden />
                      {project.memberCount}{' '}
                      {project.memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          <PaginationControls
            page={safePage}
            pageSize={DEFAULT_PAGE_SIZE}
            total={projects.total}
            pageCount={projects.pageCount}
            onPageChange={(next) => updateParams({ page: next })}
            isLoading={projectsQuery.isFetching}
            itemNoun="project"
          />
        </>
      )}

      <ProjectFormDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </>
  );
}

function ProjectGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} className="gap-3 p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </Card>
      ))}
    </div>
  );
}
