import { google, forms_v1 } from 'googleapis';
import { VacancyRequirements } from './ai-analyzer';

function getAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is not set');
  }

  const parsed = JSON.parse(credentials);
  return new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: [
      'https://www.googleapis.com/auth/forms.body',
      'https://www.googleapis.com/auth/forms.responses.readonly',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

export interface CreatedForm {
  formId: string;
  formUrl: string;
}

export async function createFormForVacancy(
  vacancyTitle: string,
  requirements: VacancyRequirements
): Promise<CreatedForm> {
  const auth = getAuth();
  const formsApi = google.forms({ version: 'v1', auth });

  // Step 1: Create the form with title
  const createRes = await formsApi.forms.create({
    requestBody: {
      info: {
        title: `Анкета кандидата: ${vacancyTitle}`,
        documentTitle: `Анкета: ${vacancyTitle}`,
      },
    },
  });

  const formId = createRes.data.formId!;

  // Step 2: Build items via batchUpdate
  const items: forms_v1.Schema$Item[] = [
    {
      title: 'Полное имя (ФИО)',
      questionItem: {
        question: {
          required: true,
          textQuestion: { paragraph: false },
        },
      },
    },
    {
      title: 'Email адрес',
      questionItem: {
        question: {
          required: true,
          textQuestion: { paragraph: false },
        },
      },
    },
    {
      title: 'Номер телефона',
      questionItem: {
        question: {
          required: true,
          textQuestion: { paragraph: false },
        },
      },
    },
    {
      title: 'Образование (учебное заведение, специальность, год окончания)',
      questionItem: {
        question: {
          required: true,
          textQuestion: { paragraph: true },
        },
      },
    },
    {
      title: 'Опыт работы (опишите детально: компания, должность, период, обязанности)',
      questionItem: {
        question: {
          required: true,
          textQuestion: { paragraph: true },
        },
      },
    },
  ];

  // Dynamic skills from requirements
  if (requirements.hard_skills?.length) {
    items.push({
      title: `Технические навыки (отметьте все, которыми владеете)`,
      questionItem: {
        question: {
          required: true,
          choiceQuestion: {
            type: 'CHECKBOX',
            options: requirements.hard_skills.map((skill) => ({ value: skill })),
          },
        },
      },
    });
  }

  // Language questions
  items.push(
    {
      title: 'Уровень владения русским языком',
      questionItem: {
        question: {
          required: true,
          choiceQuestion: {
            type: 'RADIO',
            options: [
              { value: 'Родной' },
              { value: 'Свободно (C1-C2)' },
              { value: 'Средний (B1-B2)' },
              { value: 'Базовый (A1-A2)' },
            ],
          },
        },
      },
    },
    {
      title: 'Уровень владения английским языком',
      questionItem: {
        question: {
          required: true,
          choiceQuestion: {
            type: 'RADIO',
            options: [
              { value: 'Свободно (C1-C2)' },
              { value: 'Средний (B1-B2)' },
              { value: 'Базовый (A1-A2)' },
              { value: 'Не владею' },
            ],
          },
        },
      },
    },
    {
      title: 'Уровень владения узбекским языком',
      questionItem: {
        question: {
          required: false,
          choiceQuestion: {
            type: 'RADIO',
            options: [
              { value: 'Родной' },
              { value: 'Свободно' },
              { value: 'Средний' },
              { value: 'Не владею' },
            ],
          },
        },
      },
    }
  );

  // Motivation and additional
  items.push(
    {
      title: 'Почему вы хотите работать на этой позиции?',
      questionItem: {
        question: {
          required: true,
          textQuestion: { paragraph: true },
        },
      },
    },
    {
      title: 'Ваши ключевые достижения на предыдущих местах работы',
      questionItem: {
        question: {
          required: false,
          textQuestion: { paragraph: true },
        },
      },
    },
    {
      title: 'Ожидаемая зарплата (USD в месяц)',
      questionItem: {
        question: {
          required: false,
          textQuestion: { paragraph: false },
        },
      },
    },
    {
      title: 'Ссылка на LinkedIn профиль (опционально)',
      questionItem: {
        question: {
          required: false,
          textQuestion: { paragraph: false },
        },
      },
    },
    {
      title: 'Ссылка на портфолио или GitHub (опционально)',
      questionItem: {
        question: {
          required: false,
          textQuestion: { paragraph: false },
        },
      },
    }
  );

  // Add items via batchUpdate
  const requests: forms_v1.Schema$Request[] = items.map((item, index) => ({
    createItem: {
      item,
      location: { index },
    },
  }));

  await formsApi.forms.batchUpdate({
    formId,
    requestBody: { requests },
  });

  return {
    formId,
    formUrl: `https://docs.google.com/forms/d/${formId}/viewform`,
  };
}

export async function getFormResponses(formId: string) {
  const auth = getAuth();
  const formsApi = google.forms({ version: 'v1', auth });

  const res = await formsApi.forms.responses.list({ formId });
  return res.data.responses || [];
}

export async function getFormWithQuestions(formId: string) {
  const auth = getAuth();
  const formsApi = google.forms({ version: 'v1', auth });

  const formRes = await formsApi.forms.get({ formId });
  return formRes.data;
}

export function parseFormResponse(
  response: forms_v1.Schema$FormResponse,
  form: forms_v1.Schema$Form
): Record<string, string | string[]> {
  const answers: Record<string, string | string[]> = {};

  const items = form.items || [];
  const answers_map = response.answers || {};

  for (const item of items) {
    const questionId = item.questionItem?.question?.questionId;
    if (!questionId) continue;

    const answer = answers_map[questionId];
    if (!answer) continue;

    const title = item.title || questionId;
    const textAnswers = answer.textAnswers?.answers || [];

    if (textAnswers.length === 1) {
      answers[title] = textAnswers[0].value || '';
    } else if (textAnswers.length > 1) {
      answers[title] = textAnswers.map((a) => a.value || '');
    }
  }

  return answers;
}
