import type { ProfileRef } from '@/features/projects/api';
import { buildPage, toRange, type Page, type PageRequest } from '@/lib/pagination';
import { supabase } from '@/lib/supabase';
import type { Comment } from '@/types/database';

export interface CommentWithAuthor extends Comment {
  author: ProfileRef | null;
}

interface CommentRow extends Comment {
  author: ProfileRef | null;
}

const COMMENT_SELECT = `
  *,
  author:profiles!comments_author_id_fkey (id, display_name, email)
` as const;

export interface ListCommentsParams extends PageRequest {
  taskId: string;
}

export async function listComments({
  taskId,
  page,
  pageSize,
}: ListCommentsParams): Promise<Page<CommentWithAuthor>> {
  const [from, to] = toRange({ page, pageSize });

  const { data, error, count } = await supabase
    .from('comments')
    .select(COMMENT_SELECT, { count: 'exact' })
    .eq('task_id', taskId)
    // Oldest first: a comment thread reads top-to-bottom like a conversation,
    // unlike the task list which favours newest-first.
    .order('created_at', { ascending: true })
    .range(from, to)
    .returns<CommentRow[]>();

  if (error) throw error;

  return buildPage(data ?? [], count ?? 0, { page, pageSize });
}

export async function addComment(
  taskId: string,
  authorId: string,
  message: string,
): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({ task_id: taskId, author_id: authorId, message })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}
