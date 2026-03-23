const BRAND_COLOR = '#E8721C';
const DARK_BG = '#0a0a0a';

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;padding:0;background:${DARK_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.container{max-width:600px;margin:0 auto;background:#111;border-radius:16px;overflow:hidden;border:1px solid #222}
.header{background:linear-gradient(135deg,${BRAND_COLOR},#FF9A3C);padding:32px;text-align:center}
.header h1{color:#000;font-size:20px;font-weight:800;margin:0;letter-spacing:2px}
.body{padding:32px}
.body p{color:#ccc;font-size:14px;line-height:1.7;margin:0 0 16px}
.btn{display:inline-block;padding:14px 32px;background:${BRAND_COLOR};color:#000;font-weight:700;text-decoration:none;border-radius:10px;font-size:14px}
.footer{padding:24px 32px;border-top:1px solid #222;text-align:center}
.footer p{color:#555;font-size:11px;margin:0}
.highlight{color:${BRAND_COLOR};font-weight:600}
.score-box{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:20px;text-align:center;margin:20px 0}
.score-number{font-size:48px;font-weight:800;color:${BRAND_COLOR}}
</style>
</head><body><div style="padding:24px">
<div class="container">${content}</div>
</div></body></html>`;
}

export function inviteEmail(candidateName: string, vacancyTitle: string, companyName: string, interviewDate?: string, interviewLink?: string): string {
  return baseTemplate(`
    <div class="header"><h1>SOLUTION</h1></div>
    <div class="body">
      <p>Здравствуйте, <span class="highlight">${candidateName}</span>!</p>
      <p>Мы рассмотрели вашу заявку на позицию <strong>${vacancyTitle}</strong> в компании <strong>${companyName}</strong> и хотим пригласить вас на интервью.</p>
      ${interviewDate ? `<p>📅 <strong>Дата:</strong> ${interviewDate}</p>` : ''}
      ${interviewLink ? `<p style="text-align:center;margin:24px 0"><a href="${interviewLink}" class="btn">Подтвердить участие</a></p>` : ''}
      <p>Если у вас есть вопросы, смело отвечайте на это письмо.</p>
      <p>С уважением,<br><span class="highlight">Команда ${companyName}</span></p>
    </div>
    <div class="footer"><p>Отправлено через SOLUTION AI Recruiter</p></div>
  `);
}

export function rejectEmail(candidateName: string, vacancyTitle: string, companyName: string): string {
  return baseTemplate(`
    <div class="header"><h1>SOLUTION</h1></div>
    <div class="body">
      <p>Здравствуйте, <span class="highlight">${candidateName}</span>.</p>
      <p>Благодарим вас за интерес к позиции <strong>${vacancyTitle}</strong> в компании <strong>${companyName}</strong>.</p>
      <p>К сожалению, на данном этапе мы решили продолжить рассмотрение других кандидатов, чей профиль более соответствует текущим требованиям.</p>
      <p>Мы сохранили ваше резюме и свяжемся с вами, если появятся подходящие вакансии в будущем.</p>
      <p>Желаем успехов в поиске работы!</p>
      <p>С уважением,<br><span class="highlight">Команда ${companyName}</span></p>
    </div>
    <div class="footer"><p>Отправлено через SOLUTION AI Recruiter</p></div>
  `);
}

export function offerEmail(candidateName: string, vacancyTitle: string, companyName: string, salary?: string, startDate?: string): string {
  return baseTemplate(`
    <div class="header"><h1>SOLUTION</h1></div>
    <div class="body">
      <p>Здравствуйте, <span class="highlight">${candidateName}</span>! 🎉</p>
      <p>Мы рады сообщить, что по итогам отбора на позицию <strong>${vacancyTitle}</strong>, мы хотим предложить вам эту должность в компании <strong>${companyName}</strong>!</p>
      ${salary ? `<div class="score-box"><p style="color:#999;margin:0 0 4px;font-size:12px">ПРЕДЛОЖЕНИЕ</p><div class="score-number">${salary}</div></div>` : ''}
      ${startDate ? `<p>📅 <strong>Желаемая дата выхода:</strong> ${startDate}</p>` : ''}
      <p style="text-align:center;margin:24px 0"><a href="#" class="btn">Принять предложение</a></p>
      <p>Ждём вашего ответа! Если есть вопросы — пишите.</p>
      <p>С уважением,<br><span class="highlight">Команда ${companyName}</span></p>
    </div>
    <div class="footer"><p>Отправлено через SOLUTION AI Recruiter</p></div>
  `);
}
