import { supabase } from '../config/supabase';

export interface AutoRule {
  id: string;
  vacancy_id?: string;
  user_id: string;
  condition_type: 'score_above' | 'score_below' | 'new_candidate';
  condition_value: number;
  action_type: 'auto_analyze' | 'auto_invite' | 'auto_reject' | 'notify';
  enabled: boolean;
}

// Check and execute rules for a candidate after analysis
export async function executeAutoRules(candidateId: string, userId: string): Promise<string[]> {
  const actions: string[] = [];

  try {
    // Get candidate with analysis
    const { data: candidate } = await supabase
      .from('candidates')
      .select('id, full_name, email, status, vacancy_id, ai_analysis(*)')
      .eq('id', candidateId)
      .single();

    if (!candidate) return actions;

    const rawAnalysis = Array.isArray(candidate.ai_analysis)
      ? candidate.ai_analysis[0]
      : candidate.ai_analysis;

    if (!rawAnalysis) return actions;

    const score = (rawAnalysis as Record<string, unknown>).overall_score as number;

    // Get user's auto rules (gracefully handle missing table)
    const { data: rules, error: rulesError } = await supabase
      .from('auto_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true);

    if (rulesError) {
      // Table may not exist yet — silently skip
      console.warn('[AutoActions] Could not load rules:', rulesError.message);
      return actions;
    }

    if (!rules?.length) return actions;

    for (const rule of rules) {
      // Check if rule applies to this vacancy
      if (rule.vacancy_id && rule.vacancy_id !== candidate.vacancy_id) continue;

      let shouldExecute = false;

      switch (rule.condition_type) {
        case 'score_above':
          shouldExecute = score >= rule.condition_value;
          break;
        case 'score_below':
          shouldExecute = score < rule.condition_value;
          break;
        case 'new_candidate':
          shouldExecute = true;
          break;
      }

      if (!shouldExecute) continue;

      switch (rule.action_type) {
        case 'auto_invite':
          await supabase.from('candidates').update({ status: 'invited' }).eq('id', candidateId);
          actions.push(`Автоприглашение: ${candidate.full_name} (score: ${score})`);
          break;
        case 'auto_reject':
          await supabase.from('candidates').update({ status: 'rejected' }).eq('id', candidateId);
          actions.push(`Автоотказ: ${candidate.full_name} (score: ${score})`);
          break;
        case 'notify':
          actions.push(`Уведомление: ${candidate.full_name} (score: ${score})`);
          break;
      }
    }
  } catch (err) {
    console.error('[AutoActions] Error:', err);
  }

  return actions;
}
