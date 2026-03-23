import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface VacancyRequirements {
  hard_skills: string[];
  preferred_skills?: string[];
  experience_years: number;
  education?: { required?: string; preferred?: string };
  languages?: Record<string, string>;
  industry_experience?: string[];
  soft_skills?: string[];
  special_requirements?: string[];
}

export interface VacancyWeights {
  hard_skills: number;
  experience: number;
  education: number;
  soft_skills: number;
  languages: number;
  culture_fit: number;
}

export interface Vacancy {
  id: string;
  title: string;
  requirements: VacancyRequirements;
  weights: VacancyWeights;
}

export interface Candidate {
  id: string;
  full_name: string;
  email: string;
  form_responses: Record<string, unknown>;
  resume_text?: string;
}

export interface AIAnalysisResult {
  overall_score: number;
  category: 'excellent' | 'good' | 'average' | 'below';
  scores: {
    hard_skills: number;
    experience: number;
    education: number;
    soft_skills: number;
    languages: number;
    culture_fit: number;
  };
  strengths: string[];
  weaknesses: string[];
  summary: string;
  recommendations: string[];
  insights: {
    red_flags: string[];
    green_flags: string[];
    potential_concerns: string[];
    growth_potential: 'low' | 'medium' | 'high';
    cultural_fit_notes?: string;
    salary_expectation_alignment?: string;
  };
  integrity: {
    score: number;
    level: 'trusted' | 'questionable' | 'suspicious';
    flags: string[];
    verdict: string;
  };
  independent_assessment: {
    hidden_strengths: string[];
    hidden_concerns: string[];
    beyond_criteria_notes: string;
    hire_recommendation: 'strong_yes' | 'yes' | 'neutral' | 'no' | 'strong_no';
  };
}

function buildAnalysisPrompt(candidate: Candidate, vacancy: Vacancy): string {
  return `# РОЛЬ И ЗАДАЧА

Ты — старший рекрутер и психолог с 20 годами опыта. Ты умеешь читать между строк, замечать несоответствия и видеть реальный потенциал кандидата там, где другие видят только анкету.

Твоя работа — не просто сверить ответы кандидата со списком требований, а ДУМАТЬ: насколько этот человек реально подходит, честен ли он, и что компания получит, наняв его.

# ДАННЫЕ ВАКАНСИИ

Позиция: ${vacancy.title}

Требования работодателя:
${JSON.stringify(vacancy.requirements, null, 2)}

Веса критериев оценки:
${JSON.stringify(vacancy.weights, null, 2)}

# ДАННЫЕ КАНДИДАТА

ФИО: ${candidate.full_name}
Email: ${candidate.email}

Ответы на вопросы формы:
${JSON.stringify(candidate.form_responses, null, 2)}

${candidate.resume_text ? `Текст резюме:\n${candidate.resume_text}` : 'Резюме не предоставлено.'}

# ТВОЙ АНАЛИЗ — ШАГ ЗА ШАГОМ

## ШАГ 1 — ПРОВЕРКА ЧЕСТНОСТИ (Integrity Analysis)

Проанализируй ответы кандидата на признаки обмана или преувеличений. Ищи:

- **Зеркалирование вакансии**: Кандидат просто вставил ключевые слова из описания вакансии в свои ответы, не раскрывая реального опыта
- **Расплывчатость без конкретики**: Говорит "отлично работаю в команде", "быстро обучаюсь" без единого реального примера
- **Нереалистичные заявления**: Заявленный опыт 10 лет не соответствует контексту (напр. возраст, дата выпуска из универа)
- **Противоречия**: Разные части анкеты противоречат друг другу (напр. "5 лет Python" но не знает базовых концепций)
- **Слишком идеальные ответы**: Ни одного "слабого места" или трудности — это ненатурально
- **Отсутствие базовых знаний**: Человек с заявленным уровнем должен знать X, Y, Z — а он об этом молчит
- **Копипаст**: Ответы звучат как скопированные из интернета, нет личного голоса
- **Завышение должностей**: Называет себя "senior" или "lead", но опыт и ответы говорят об обратном

Integrity Score: от 0 (явный обман) до 100 (полностью достоверно)
Levels: trusted (80-100), questionable (50-79), suspicious (0-49)

## ШАГ 2 — СТАНДАРТНАЯ ОЦЕНКА ПО КРИТЕРИЯМ

Оцени по каждому критерию от 0 до 100, используя заданные веса:
- Hard Skills: технические навыки и инструменты
- Experience: реальный опыт работы, не просто годы
- Education: образование и самообучение
- Soft Skills: коммуникация, командная работа, лидерство
- Languages: языковые навыки
- Culture Fit: соответствие культуре и ценностям компании

## ШАГ 3 — НЕЗАВИСИМАЯ ОЦЕНКА (НЕ ТОЛЬКО ПО СПИСКУ ТРЕБОВАНИЙ)

Используй СВОЁ профессиональное знание о том, что нужно для успеха на позиции "${vacancy.title}". Думай:

- Какие навыки и качества реально важны для этой роли в реальной жизни, которые работодатель мог не упомянуть?
- Есть ли у кандидата скрытые сильные стороны, которые ценны для этой роли, даже если они не в требованиях?
- Есть ли скрытые риски, которые работодатель не предусмотрел в своих требованиях?
- Твоя интуиция как опытного рекрутера — нанял бы ты этого человека?

Hire Recommendation:
- strong_yes: сильный кандидат, брать без колебаний
- yes: хороший кандидат, рекомендую
- neutral: есть вопросы, нужно уточнить на интервью
- no: есть серьезные сомнения
- strong_no: явно не подходит или есть признаки обмана

# ФОРМАТ ОТВЕТА (строго валидный JSON, без markdown блоков, без комментариев)

{
  "overall_score": 85,
  "category": "good",
  "scores": {
    "hard_skills": 90,
    "experience": 75,
    "education": 85,
    "soft_skills": 80,
    "languages": 95,
    "culture_fit": 70
  },
  "strengths": ["конкретная сильная сторона 1", "конкретная сильная сторона 2", "конкретная сильная сторона 3"],
  "weaknesses": ["конкретная слабая сторона 1", "конкретная слабая сторона 2", "конкретная слабая сторона 3"],
  "summary": "2-3 предложения о кандидате с конкретикой, не общими фразами",
  "recommendations": ["конкретный вопрос или рекомендация для интервью 1", "...", "...", "...", "..."],
  "insights": {
    "red_flags": ["конкретный красный флаг если есть"],
    "green_flags": ["конкретный зелёный флаг если есть"],
    "potential_concerns": ["конкретное потенциальное беспокойство если есть"],
    "growth_potential": "high"
  },
  "integrity": {
    "score": 85,
    "level": "trusted",
    "flags": ["конкретное замечание о честности если есть, иначе пустой массив"],
    "verdict": "1-2 предложения об уровне достоверности ответов кандидата"
  },
  "independent_assessment": {
    "hidden_strengths": ["то что ИИ заметил сам, не из требований, если есть"],
    "hidden_concerns": ["то что ИИ заметил сам как риск, если есть"],
    "beyond_criteria_notes": "наблюдение ИИ о кандидате, выходящее за рамки формальных требований",
    "hire_recommendation": "yes"
  }
}`;
}

export async function analyzeCandidate(
  candidate: Candidate,
  vacancy: Vacancy
): Promise<AIAnalysisResult> {
  const prompt = buildAnalysisPrompt(candidate, vacancy);

  let response;
  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thinking: { type: 'adaptive' } as any,
      messages: [{ role: 'user', content: prompt }],
    });

    response = await stream.finalMessage();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (err as any)?.status;
    if (status === 429) {
      console.error(`[AI Analyzer] Rate limit exceeded for candidate ${candidate.id}:`, errMsg);
      throw new Error('AI rate limit exceeded. Please try again later.');
    }
    if (status === 529) {
      console.error(`[AI Analyzer] API overloaded for candidate ${candidate.id}:`, errMsg);
      throw new Error('AI service is temporarily overloaded. Please try again later.');
    }
    console.error(`[AI Analyzer] API error for candidate ${candidate.id}:`, errMsg);
    throw new Error(`AI analysis failed: ${errMsg}`);
  }

  const textBlock = response.content.find((b) => b.type === 'text');

  if (!textBlock || textBlock.type !== 'text') {
    console.error(`[AI Analyzer] No text block in response for candidate ${candidate.id}. Content types:`, response.content.map(b => b.type));
    throw new Error('No text response from AI');
  }

  const text = textBlock.text.trim();

  // Strip markdown code blocks if present
  const jsonText = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();

  let result: AIAnalysisResult;
  try {
    result = JSON.parse(jsonText) as AIAnalysisResult;
  } catch (err) {
    console.error(`[AI Analyzer] Failed to parse JSON response for candidate ${candidate.id}. Raw text (first 500 chars):`, jsonText.slice(0, 500));
    throw new Error('Failed to parse AI response as JSON');
  }

  // Validate category
  if (!['excellent', 'good', 'average', 'below'].includes(result.category)) {
    if (result.overall_score >= 90) result.category = 'excellent';
    else if (result.overall_score >= 75) result.category = 'good';
    else if (result.overall_score >= 60) result.category = 'average';
    else result.category = 'below';
  }

  return result;
}

export async function batchAnalyzeCandidates(
  candidates: Candidate[],
  vacancy: Vacancy
): Promise<Array<{ candidate_id: string; analysis?: AIAnalysisResult; error?: string }>> {
  const results = [];

  for (const candidate of candidates) {
    try {
      const analysis = await analyzeCandidate(candidate, vacancy);
      results.push({ candidate_id: candidate.id, analysis });
      // Rate limiting pause
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AI Analyzer] Batch analysis failed for candidate ${candidate.id}:`, errMsg);
      results.push({
        candidate_id: candidate.id,
        error: errMsg,
      });
    }
  }

  return results;
}

// ── Interview Questions Generator ─────────────────────────────────────────────

export interface InterviewQuestions {
  technical: string[];
  behavioral: string[];
  situational: string[];
}

export async function generateInterviewQuestions(
  candidate: Candidate,
  vacancy: Vacancy,
): Promise<InterviewQuestions> {
  const prompt = `Ты опытный HR-интервьюер. Составь персонализированные вопросы для интервью.

Вакансия: ${vacancy.title}
Требования: ${JSON.stringify(vacancy.requirements, null, 2)}

Кандидат: ${candidate.full_name}
Ответы кандидата: ${JSON.stringify(candidate.form_responses, null, 2)}
${candidate.resume_text ? `Резюме (фрагмент):\n${candidate.resume_text.slice(0, 2000)}` : ''}

Сгенерируй РОВНО 3 технических вопроса, 3 поведенческих вопроса и 2 ситуационных вопроса.
Вопросы должны быть конкретными, привязанными к опыту кандидата и требованиям вакансии.
Пиши на русском языке.

Верни ТОЛЬКО валидный JSON без каких-либо пояснений:
{
  "technical": ["вопрос1", "вопрос2", "вопрос3"],
  "behavioral": ["вопрос1", "вопрос2", "вопрос3"],
  "situational": ["вопрос1", "вопрос2"]
}`;

  let message;
  try {
    message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[AI Analyzer] Interview questions API error for candidate ${candidate.id}:`, errMsg);
    throw new Error(`Failed to generate interview questions: ${errMsg}`);
  }

  const content = message.content[0];
  if (content.type !== 'text') {
    console.error(`[AI Analyzer] Unexpected response type for interview questions: ${content.type}`);
    throw new Error('Unexpected response type from AI');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[AI Analyzer] Could not extract JSON from interview questions response. Raw text (first 500 chars):', content.text.slice(0, 500));
    throw new Error('Could not extract JSON from AI response');
  }

  try {
    return JSON.parse(jsonMatch[0]) as InterviewQuestions;
  } catch (err) {
    console.error('[AI Analyzer] Failed to parse interview questions JSON:', err instanceof Error ? err.message : err);
    throw new Error('Failed to parse interview questions response as JSON');
  }
}
