import type { TaskFilters } from '@/features/tasks/filters';
import { ALL, UNASSIGNED } from '@/features/tasks/filters';
import type { TaskFormValues } from '@/features/tasks/schemas';
import type { ProfileRef } from '@/features/projects/api';
import { buildPage, toRange, type Page, type PageRequest } from '@/lib/pagination';
import { supabase } from '@/lib/supabase';
import type { Task, TaskStatus } from '@/types/database';

/**
 * Task data access. See features/projects/api.ts for why this indirection
 * exists — the short version is that components never talk to supabase-js
 * directly.
 */

export interface TaskWithRelations extends Task {
  assignee: ProfileRef | null;
  createdByProfile: ProfileRef | null;
  commentCount: number;
}

interface TaskRow extends Task {
  assignee: ProfileRef | null;
  created_by_profile: ProfileRef | null;
  comments: { count: number }[];
}

const TASK_SELECT = `
  *,
  assignee:profiles!tasks_assignee_id_fkey (id, display_name, email),
  created_by_profile:profiles!tasks_created_by_fkey (id, display_name, email),
  comments (count)
` as const;

function mapTaskRow(row: TaskRow): TaskWithRelations {
  const { comments, created_by_profile, ...task } = row;
  return {
    ...task,
    createdByProfile: created_by_profile,
    commentCount: comments[0]?.count ?? 0,
  };
}

export interface ListTasksParams extends PageRequest {
  projectId: string;
  filters: TaskFilters;
}

export async function listTasks({
  projectId,
  filters,
  page,
  pageSize,
}: ListTasksParams): Promise<Page<TaskWithRelations>> {
  const [from, to] = toRange({ page, pageSize });

  let query = supabase
    .from('tasks')
    .select(TASK_SELECT, { count: 'exact' })
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .range(from, to);

  const term = filters.search.trim();
  if (term) {
    const escaped = term.replace(/[%_]/g, (match) => `\\${match}`);
    query = query.ilike('title', `%${escaped}%`);
  }

  if (filters.status !== ALL) {
    query = query.eq('status', filters.status);
  }

  if (filters.priority !== ALL) {
    query = query.eq('priority', filters.priority);
  }

  if (filters.assigneeId === UNASSIGNED) {
    query = query.is('assignee_id', null);
  } else if (filters.assigneeId !== ALL) {
    query = query.eq('assignee_id', filters.assigneeId);
  }

  if (filters.dueFrom) {
    query = query.gte('due_date', filters.dueFrom);
  }
  if (filters.dueTo) {
    query = query.lte('due_date', filters.dueTo);
  }

  const { data, error, count } = await query.returns<TaskRow[]>();
  if (error) throw error;

  return buildPage((data ?? []).map(mapTaskRow), count ?? 0, { page, pageSize });
}

export async function getTask(taskId: string): Promise<TaskWithRelations> {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('id', taskId)
    .single()
    .returns<TaskRow>();

  if (error) throw error;
  return mapTaskRow(data);
}

export async function createTask(
  projectId: string,
  values: TaskFormValues,
  createdBy: string,
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: projectId,
      title: values.title,
      description: values.description,
      status: values.status,
      priority: values.priority,
      due_date: values.dueDate,
      assignee_id: values.assigneeId,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTask(
  taskId: string,
  values: TaskFormValues,
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      title: values.title,
      description: values.description,
      status: values.status,
      priority: values.priority,
      due_date: values.dueDate,
      assignee_id: values.assigneeId,
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Narrow update for the status dropdown on the task card — avoids sending a
 * full form payload for a single-field change. */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}
