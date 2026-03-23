import { supabase } from '../config/supabase';

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message?: string,
  link?: string
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message: message ?? null,
    link: link ?? null,
  });
  if (error) {
    console.error('[Notify] Failed to create notification:', error.message);
  }
}
