import type { ProjectFormValues } from '@/features/projects/schemas';
import { buildPage, toRange, type Page, type PageRequest } from '@/lib/pagination';
import { supabase } from '@/lib/supabase';
import type { Profile, Project, ProjectRole } from '@/types/database';

/**
 * Project data access.
 *
 * Everything the UI knows about projects goes through this module. Components
 * never import the supabase client directly, which keeps query construction in
 * one testable place and means the transport could be swapped without touching
 * a single component.
 */

/** The subset of a profile the UI actually renders. */
export type ProfileRef = Pick<Profile, 'id' | 'display_name' | 'email'>;

export interface ProjectSummary extends Project {
  owner: ProfileRef | null;
  taskCount: number;
  memberCount: number;
}

export interface ProjectMemberWithProfile {
  projectId: string;
  role: ProjectRole;
  createdAt: string;
  profile: ProfileRef;
}

/**
 * PostgREST returns embedded aggregates as an array containing a single count
 * object — `tasks: [{ count: 12 }]`. Modelling the wire shape separately from
 * the shape the UI wants keeps that oddity from leaking into components, and
 * makes the mapper below independently unit-testable.
 */
interface ProjectRowWithCounts extends Project {
  owner: ProfileRef | null;
  tasks: { count: number }[];
  project_members: { count: number }[];
}

const PROJECT_SELECT = `
  *,
  owner:profiles!projects_owner_id_fkey (id, display_name, email),
  tasks (count),
  project_members (count)
` as const;

/** Exported for tests: the array-wrapped count is easy to get wrong. */
export function mapProjectRow(row: ProjectRowWithCounts): ProjectSummary {
  const { tasks, project_members: members, ...project } = row;

  return {
    ...project,
    taskCount: tasks[0]?.count ?? 0,
    memberCount: members[0]?.count ?? 0,
  };
}

export interface ListProjectsParams extends PageRequest {
  /** Case-insensitive match against the project name. */
  search?: string;
}

export async function listProjects({
  page,
  pageSize,
  search,
}: ListProjectsParams): Promise<Page<ProjectSummary>> {
  const [from, to] = toRange({ page, pageSize });

  let query = supabase
    .from('projects')
    // count:'exact' asks PostgREST for the total via Content-Range, which is
    // what lets the pager show "Page 2 of 7" rather than only "next/previous".
    .select(PROJECT_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  const term = search?.trim();
  if (term) {
    // Escaping % and _ stops a user's literal underscore from acting as a
    // single-character wildcard, which silently widens their search.
    const escaped = term.replace(/[%_]/g, (match) => `\\${match}`);
    query = query.ilike('name', `%${escaped}%`);
  }

  const { data, error, count } = await query.returns<ProjectRowWithCounts[]>();
  if (error) throw error;

  return buildPage((data ?? []).map(mapProjectRow), count ?? 0, { page, pageSize });
}

export async function getProject(projectId: string): Promise<ProjectSummary> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', projectId)
    // .single() turns "no rows" into PGRST116, which errors.ts renders as
    // "Not found, or you do not have access to it" — the same message whether
    // the project is missing or merely invisible, so nothing is leaked.
    .single()
    .returns<ProjectRowWithCounts>();

  if (error) throw error;
  return mapProjectRow(data);
}

export async function createProject(
  values: ProjectFormValues,
  ownerId: string,
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    // owner_id is sent explicitly because the INSERT policy checks
    // `owner_id = auth.uid()`. A mismatch is rejected by the database, so a
    // client cannot create a project on someone else's behalf.
    .insert({ ...values, owner_id: ownerId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(
  projectId: string,
  values: ProjectFormValues,
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(values)
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}

/* ---------------------------------------------------------------------------
 * Membership
 * ------------------------------------------------------------------------ */

interface MemberRow {
  project_id: string;
  role: ProjectRole;
  created_at: string;
  profile: ProfileRef | null;
}

export async function listProjectMembers(
  projectId: string,
): Promise<ProjectMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select(
      `project_id, role, created_at,
       profile:profiles!project_members_user_id_fkey (id, display_name, email)`,
    )
    .eq('project_id', projectId)
    // Owner first, then alphabetical, so the list reads predictably.
    .order('role', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<MemberRow[]>();

  if (error) throw error;

  return (data ?? [])
    // profile is typed nullable because PostgREST models embeds as optional.
    // The FK is NOT NULL, so this filter only satisfies the type checker.
    .filter((row): row is MemberRow & { profile: ProfileRef } => row.profile !== null)
    .map((row) => ({
      projectId: row.project_id,
      role: row.role,
      createdAt: row.created_at,
      profile: row.profile,
    }));
}

/**
 * Adds a member by email address.
 *
 * Goes through an RPC rather than an insert because resolving an email to a
 * user id requires reading a profile the caller cannot yet see — see
 * supabase/migrations/20260801001000_membership_rpc.sql.
 */
export async function addProjectMemberByEmail(
  projectId: string,
  email: string,
): Promise<void> {
  const { error } = await supabase.rpc('add_project_member_by_email', {
    p_project_id: projectId,
    p_email: email,
  });

  if (error) throw error;
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) throw error;
}
