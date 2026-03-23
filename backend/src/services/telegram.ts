const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.log('[Telegram] Bot token not set, skipping notification');
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      console.error('[Telegram] Send failed:', await res.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Telegram] Error:', err);
    return false;
  }
}

// Notification templates
export function formatNewCandidate(candidateName: string, vacancyTitle: string, email?: string): string {
  return `🆕 <b>Новый кандидат!</b>\n\n👤 ${candidateName}\n💼 ${vacancyTitle}${email ? '\n📧 ' + email : ''}\n\n<i>Откройте SOLUTION для анализа</i>`;
}

export function formatAnalysisComplete(candidateName: string, score: number, category: string): string {
  const emoji = score >= 90 ? '🌟' : score >= 75 ? '✅' : score >= 60 ? '⚠️' : '❌';
  return `${emoji} <b>AI анализ завершён</b>\n\n👤 ${candidateName}\n📊 Балл: <b>${score}/100</b>\n🏷 Категория: ${category}\n\n<i>Откройте SOLUTION для деталей</i>`;
}

export function formatDailySummary(vacancies: number, candidates: number, analyzed: number): string {
  return `📊 <b>Ежедневный отчёт SOLUTION</b>\n\n💼 Активных вакансий: ${vacancies}\n👥 Новых кандидатов: ${candidates}\n🧠 AI анализов: ${analyzed}\n\n<i>mysolution.uz</i>`;
}

// Format vacancy for Telegram channel
export function formatVacancyPost(vacancy: {
  title: string;
  description?: string;
  location?: string;
  remote?: boolean;
  salary_range?: { min: number; max: number; currency: string };
  requirements?: { hard_skills?: string[]; experience_years?: number };
  apply_url: string;
}): string {
  let text = `🔥 <b>${vacancy.title}</b>\n\n`;

  if (vacancy.description) {
    text += `${vacancy.description.slice(0, 300)}${vacancy.description.length > 300 ? '...' : ''}\n\n`;
  }

  if (vacancy.location) text += `📍 ${vacancy.location}`;
  if (vacancy.remote) text += ` (удалённо)`;
  text += '\n';

  if (vacancy.salary_range) {
    text += `💰 ${vacancy.salary_range.min.toLocaleString()} — ${vacancy.salary_range.max.toLocaleString()} ${vacancy.salary_range.currency}\n`;
  }

  if (vacancy.requirements?.experience_years) {
    text += `⏳ Опыт: ${vacancy.requirements.experience_years}+ лет\n`;
  }

  if (vacancy.requirements?.hard_skills?.length) {
    text += `🛠 ${vacancy.requirements.hard_skills.slice(0, 6).join(', ')}\n`;
  }

  text += `\n📝 <a href="${vacancy.apply_url}">Откликнуться</a>`;
  text += `\n\n<i>Опубликовано через SOLUTION AI</i>`;

  return text;
}

// Post vacancy to Telegram channel
export async function postVacancyToTelegram(channelId: string, vacancy: Parameters<typeof formatVacancyPost>[0]): Promise<boolean> {
  const text = formatVacancyPost(vacancy);
  return sendTelegramMessage(channelId, text);
}
