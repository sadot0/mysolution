# SOLUTION HUB — Техническая документация

## Версия: 2.1.0 | Дата: Март 2026 | Ташкент, Узбекистан

---

## 1. Обзор проекта

**SOLUTION** — хаб решений для бизнеса. Платформа где компании находят людей, выстраивают HR-процессы и масштабируются.

**SOLUTION HUB** — SaaS-платформа (веб-приложение), включающая:
- Умный рекрутер с AI-анализом резюме
- Управление вакансиями и кандидатами
- Аудит и отчётность
- Система тестирования
- HR-аутсорсинг и консалтинг

**Домен:** https://mysolution.uz
**GitHub:** https://github.com/sadot0/mysolution
**Instagram:** @mysolution.hub

---

## 2. Команда

| Имя | Роль | Зона ответственности |
|-----|------|---------------------|
| Вохидов Мирзабек | Основатель и CEO | Технологии, продукт, стратегия, AI |
| Вохидова Ситора | Со-основатель | HR-стратегия, контракты, аутсорсинг |
| Абдуллаева Матлюба | Со-основатель | HR-операции, консалтинг |

---

## 3. Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    mysolution.uz                         │
│                                                         │
│  ┌─────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Landing  │  │  SOLUTION    │  │    Backend API    │  │
│  │  (HTML)  │  │  HUB (React) │  │  (Node/Express)   │  │
│  │  4700L   │  │  21 pages    │  │  12 routes        │  │
│  └─────────┘  └──────────────┘  └───────────────────┘  │
│       │              │                    │              │
│       └──────────────┼────────────────────┘              │
│                      │                                   │
│              ┌───────┴───────┐                           │
│              │    Nginx      │                           │
│              │  SSL (HTTPS)  │                           │
│              │  Gzip, Cache  │                           │
│              └───────────────┘                           │
│                                                         │
│                VDS: 91.213.99.175                        │
│                Ubuntu 22.04, 4CPU, 4GB RAM               │
└─────────────────────────────────────────────────────────┘
         │                    │
    ┌────┴────┐         ┌────┴────┐
    │Supabase │         │Claude AI│
    │(Postgres)│         │(Anthropic)│
    │Singapore │         │  API    │
    └─────────┘         └─────────┘
```

---

## 4. Технологический стек

### Frontend
| Технология | Версия | Назначение |
|-----------|--------|-----------|
| React | 18 | UI фреймворк |
| TypeScript | 5.7 | Типизация |
| Vite | 6.4 | Сборка + dev-сервер |
| Tailwind CSS | 3 | Стили |
| Framer Motion | 11 | Анимации |
| React Query | 5 | Кеширование данных |
| Zustand | 4 | Управление состоянием |
| React Router | 6 | Маршрутизация |
| Recharts | 2 | Графики |
| Axios | 1 | HTTP клиент |
| Lucide React | — | Иконки |

### Backend
| Технология | Версия | Назначение |
|-----------|--------|-----------|
| Node.js | 22 | Среда выполнения |
| Express | 4.21 | HTTP сервер |
| TypeScript | 5.7 | Типизация |
| Supabase JS | 2.47 | Клиент PostgreSQL |
| Anthropic SDK | 0.39 | Claude AI API |
| JWT (jsonwebtoken) | 9 | Авторизация |
| bcryptjs | 2.4 | Хеширование паролей |
| PDFKit | — | Генерация PDF |
| XLSX | — | Генерация Excel |
| Nodemailer | 8 | Отправка email |
| Multer | 1.4 | Загрузка файлов |
| Helmet | 8 | Security headers |
| HPP | — | HTTP Parameter Pollution |
| Compression | — | Gzip сжатие |

### Инфраструктура
| Компонент | Сервис | Детали |
|-----------|--------|--------|
| Сервер | VDS (hostmaster.uz) | 4CPU, 4GB RAM, 100GB SSD, Ubuntu 22.04 |
| База данных | Supabase | PostgreSQL, Сингапур, Free tier |
| AI | Anthropic Claude | claude-opus-4-6, API |
| DNS | hostmaster.uz | mysolution.uz |
| SSL | Let's Encrypt | Автообновление через certbot |
| Process Manager | PM2 | Автоперезапуск, логирование |
| Web Server | Nginx | Reverse proxy, SSL, Gzip, кеширование |
| Git | GitHub | github.com/sadot0/mysolution |

---

## 5. Структура проекта

```
mysolution/
├── frontend/               # React SPA (21 страница)
│   ├── src/
│   │   ├── pages/          # 21 страница
│   │   │   ├── DashboardPage.tsx      # Главная (command center)
│   │   │   ├── LoginPage.tsx          # Вход / Регистрация
│   │   │   ├── ForgotPasswordPage.tsx # Сброс пароля
│   │   │   ├── VerifyEmailPage.tsx    # Подтверждение email
│   │   │   ├── VacanciesPage.tsx      # Список вакансий
│   │   │   ├── VacancyPage.tsx        # Детали вакансии + кандидаты
│   │   │   ├── CandidatePage.tsx      # Профиль кандидата + AI анализ
│   │   │   ├── CandidatesGlobalPage.tsx # Все кандидаты
│   │   │   ├── AnalyticsPage.tsx      # Аналитика + воронка
│   │   │   ├── InterviewsPage.tsx     # Интервью (календарь)
│   │   │   ├── TalentPoolPage.tsx     # База талантов
│   │   │   ├── AssessmentsPage.tsx    # Тестирование
│   │   │   ├── ReportsPage.tsx        # Отчёты и аудит
│   │   │   ├── TeamPage.tsx           # Команда
│   │   │   ├── SettingsPage.tsx       # Настройки + токены + 2FA
│   │   │   ├── AdminPage.tsx          # Админ-панель (6 табов)
│   │   │   ├── SupportPage.tsx        # Поддержка
│   │   │   ├── ApplyPage.tsx          # Публичная форма заявки
│   │   │   ├── CRMPage.tsx            # CRM (Coming Soon)
│   │   │   ├── LMSPage.tsx            # Обучение (Coming Soon)
│   │   │   └── NotFoundPage.tsx       # 404
│   │   ├── components/     # 9 компонентов
│   │   │   ├── Layout.tsx             # Сайдбар + навигация
│   │   │   ├── KanbanBoard.tsx        # Kanban с drag-and-drop
│   │   │   ├── CompareModal.tsx       # Сравнение кандидатов
│   │   │   ├── NotificationBell.tsx   # Уведомления
│   │   │   ├── Onboarding.tsx         # Онбординг (6 шагов)
│   │   │   ├── ScoreRing.tsx          # Кольцо оценки AI
│   │   │   ├── SkillsRadar.tsx        # Radar chart навыков
│   │   │   ├── QuestionBuilder.tsx    # Конструктор вопросов
│   │   │   └── ScrollToTop.tsx        # Кнопка "Наверх"
│   │   ├── utils/          # 8 утилит
│   │   │   ├── api.ts                 # 13 API модулей
│   │   │   ├── auth-store.ts          # Zustand store
│   │   │   ├── animations.ts          # Framer Motion variants
│   │   │   ├── helpers.ts             # Форматирование, цвета
│   │   │   ├── sanitize.ts            # XSS защита
│   │   │   ├── usePageTitle.ts        # Динамические title
│   │   │   ├── useKeyboardShortcuts.ts # Горячие клавиши
│   │   │   └── useSessionTimeout.ts   # Таймаут сессии
│   │   └── types/index.ts  # TypeScript типы
│   ├── public/              # Статика (logos, PWA)
│   └── index.html
│
├── backend/                # Node.js API
│   ├── src/
│   │   ├── routes/         # 12 роутов
│   │   │   ├── auth.ts                # Регистрация, логин, Google, LinkedIn, 2FA
│   │   │   ├── vacancies.ts           # CRUD вакансий, hh.uz, Telegram
│   │   │   ├── candidates.ts          # CRUD кандидатов, AI анализ, PDF, email
│   │   │   ├── analytics.ts           # Аналитика, воронка
│   │   │   ├── organizations.ts       # Организации, брендинг
│   │   │   ├── admin.ts               # Админ-панель, usage stats
│   │   │   ├── support.ts             # Тикеты поддержки
│   │   │   ├── tokens.ts              # Токены, баланс, whitelist
│   │   │   ├── payments.ts            # Платежи (placeholder)
│   │   │   ├── notifications.ts       # Уведомления
│   │   │   ├── interviews.ts          # Интервью CRUD
│   │   │   └── talent-pool.ts         # База талантов CRUD
│   │   ├── services/       # 12 сервисов
│   │   │   ├── ai-analyzer.ts         # Claude AI анализ резюме
│   │   │   ├── encryption.ts          # AES-256-GCM шифрование
│   │   │   ├── email.ts               # Отправка email (Gmail/SMTP)
│   │   │   ├── email-templates.ts     # HTML шаблоны (приглашение/отказ/оффер)
│   │   │   ├── pdf-report.ts          # Генерация PDF отчётов
│   │   │   ├── telegram.ts            # Telegram бот уведомления
│   │   │   ├── hh-integration.ts      # HeadHunter API
│   │   │   ├── notify.ts              # In-app уведомления
│   │   │   ├── auto-actions.ts        # Автоправила по score
│   │   │   ├── candidate-verification.ts # Верификация кандидатов
│   │   │   ├── document-parser.ts     # Парсинг PDF/DOCX
│   │   │   └── google-forms.ts        # Google Forms интеграция
│   │   ├── middleware/
│   │   │   ├── auth.ts                # JWT авторизация
│   │   │   └── logger.ts              # Логирование запросов
│   │   ├── utils/
│   │   │   └── validate.ts            # Валидация входных данных
│   │   └── index.ts                   # Express app, Nginx proxy
│   └── .env                           # Environment variables
│
├── landing/                # Лендинг (статический HTML)
│   ├── index.html          # 4700+ строк, 17 секций
│   ├── logo-icon.svg
│   └── logo-full.svg
│
├── database/
│   └── schema.sql          # PostgreSQL схема (15 таблиц)
│
├── deploy/                 # Скрипты деплоя
│   ├── nginx.conf
│   ├── setup.sh
│   ├── deploy.sh
│   └── env.production
│
└── DOCUMENTATION.md        # Этот файл
```

---

## 6. База данных (15 таблиц)

```sql
-- Основные
users                    -- Пользователи (email, пароль, роль, токены)
vacancies                -- Вакансии (title, requirements, status)
candidates               -- Кандидаты (ФИО, email, резюме, статус)
ai_analysis              -- AI оценки (score, категория, параметры)
organizations            -- Организации (name, plan)
organization_members     -- Участники организации (role)

-- Токены и платежи
token_transactions       -- Транзакции токенов (покупка, списание, бонус)
token_plans              -- Тарифные планы

-- Поддержка
support_tickets          -- Тикеты поддержки (категория, приоритет, статус)

-- Активность
usage_logs               -- Лог использования (действия, токены)
notifications            -- Уведомления (тип, прочитано)

-- Модули
interviews               -- Интервью (дата, тип, статус)
talent_pool              -- База талантов (навыки, рейтинг)
auto_rules               -- Автоправила (условие, действие)
admin_whitelist          -- Белый список админов
```

---

## 7. API Endpoints

### Auth (`/api/auth/`)
| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| POST | /register | Регистрация | Нет |
| POST | /login | Вход | Нет |
| POST | /google | Google OAuth | Нет |
| POST | /linkedin | LinkedIn OAuth | Нет |
| POST | /forgot-password | Сброс пароля | Нет |
| POST | /reset-password | Новый пароль | Нет |
| POST | /verify | Подтверждение email | Да |
| POST | /resend-code | Повторная отправка кода | Да |
| PUT | /profile | Обновление профиля | Да |
| POST | /2fa/setup | Настройка 2FA | Да |
| POST | /2fa/verify | Подтверждение 2FA | Да |
| POST | /2fa/disable | Отключение 2FA | Да |
| PUT | /telegram | Подключение Telegram | Да |
| GET | /health | Health check | Нет |

### Vacancies (`/api/vacancies/`)
| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| GET | / | Список вакансий | Да |
| GET | /:id | Детали вакансии | Да |
| POST | / | Создание вакансии | Да |
| PUT | /:id | Обновление вакансии | Да |
| PATCH | /:id/status | Смена статуса | Да |
| DELETE | /:id | Удаление | Да |
| POST | /:id/publish-hh | Публикация на hh.uz | Да |
| POST | /:id/post-telegram | Публикация в Telegram | Да |
| POST | /:id/generate-form | Создание Google Forms | Да |

### Candidates (`/api/candidates/`)
| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| GET | / | Все кандидаты | Да |
| GET | /vacancy/:id | Кандидаты вакансии | Да |
| GET | /:id | Детали кандидата | Да |
| POST | / | Добавление кандидата | Да |
| POST | /:id/analyze | AI анализ (10 токенов) | Да |
| POST | /:id/interview-questions | Вопросы (5 токенов) | Да |
| POST | /:id/send-email | Email кандидату | Да |
| GET | /:id/report | PDF отчёт | Да |
| GET | /vacancy/:id/export | CSV экспорт (2 токена) | Да |
| GET | /vacancy/:id/export-excel | Excel экспорт | Да |
| GET | /vacancy/:id/report-pdf | Batch PDF | Да |
| GET | /vacancy/:id/export-audit | Аудит JSON | Да |
| POST | /compare | Сравнение кандидатов | Да |
| PATCH | /:id/status | Смена статуса | Да |

### Tokens (`/api/tokens/`)
| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| GET | /balance | Баланс токенов | Да |
| GET | /plans | Тарифные планы | Нет |
| GET | /history | История транзакций | Да |
| POST | /use | Списание токенов | Да |
| POST | /custom-price | Расчёт кастомной цены | Нет |
| GET | /admin/stats | Статистика (admin) | Admin |
| POST | /admin/bonus | Начисление бонуса | Admin |
| GET | /admin/whitelist | Белый список | Admin |
| POST | /admin/whitelist | Добавить в whitelist | Admin |
| DELETE | /admin/whitelist/:id | Удалить из whitelist | Admin |

### Other APIs
| Путь | Описание |
|------|----------|
| /api/analytics/ | Аналитика, воронка |
| /api/support/ | Тикеты поддержки |
| /api/notifications/ | Уведомления |
| /api/interviews/ | Интервью CRUD |
| /api/talent-pool/ | База талантов |
| /api/payments/ | Методы оплаты |
| /api/organizations/ | Организации, брендинг |
| /api/admin/ | Админ-панель, usage |

---

## 8. Система токенов

### Стоимость операций
| Операция | Токены |
|----------|--------|
| AI анализ резюме | 10 |
| Вопросы для интервью | 5 |
| Создание Google Forms | 3 |
| CSV экспорт | 2 |
| Excel экспорт | 2 |

### Тарифные планы
| План | Токены | Цена (сум) | Цена (USD) | За токен |
|------|--------|-----------|-----------|----------|
| Бесплатно | 100 | 0 | 0 | — |
| Стартер | 500 | 50,000 | $3.99 | 100 сум |
| Бизнес | 2,000 | 150,000 | $11.99 | 75 сум |
| Корпоративный | 10,000 | 500,000 | $39.99 | 50 сум |
| Свой пакет | 50-50,000 | расчёт | расчёт | от 400 сум |

### Скидки за объём
| Количество | Скидка |
|-----------|--------|
| 500+ | 5% |
| 2,000+ | 10% |
| 5,000+ | 15% |
| 10,000+ | 20% |

### Себестоимость
- Стоимость 1 AI анализа (Claude API): ~$0.05-0.10
- Продажная цена 10 токенов: ~$0.40
- **Маржа: 300-700%**

---

## 9. Безопасность

| Уровень | Технология | Описание |
|---------|-----------|----------|
| Шифрование данных | AES-256-GCM | Шифрование PII кандидатов |
| Пароли | bcrypt (12 rounds) | Хеширование паролей |
| Авторизация | JWT (7 дней) | Токен аутентификации |
| 2FA | TOTP | Двухфакторная (опционально) |
| SSL | Let's Encrypt | HTTPS everywhere |
| Headers | Helmet | HSTS, X-Frame, noSniff, XSS |
| Input | Sanitization | HTML escape, UUID validation |
| Rate Limiting | express-rate-limit | Auth: 50/15мин, API: 200/15мин |
| Account Lockout | In-memory | 5 попыток → 15 мин блокировка |
| CORS | Whitelist | Только mysolution.uz |
| Session | Auto-logout | Предупреждение + auto-logout |
| HPP | hpp middleware | HTTP Parameter Pollution |
| Compression | gzip | Сжатие ответов |
| CSP | meta tag | Content Security Policy |
| XSS | sanitize.ts | Escape HTML + sanitize URL |
| UUID | validate.ts | 43 точки валидации |

---

## 10. AI Анализ резюме

### Параметры оценки (0-100)
| Параметр | Вес | Описание |
|----------|-----|----------|
| hard_skills | 40% | Технические навыки |
| experience | 25% | Опыт работы |
| education | 15% | Образование |
| soft_skills | 10% | Мягкие навыки |
| languages | 5% | Языки |
| culture_fit | 5% | Культурное соответствие |

### Категории
| Категория | Балл | Описание |
|-----------|------|----------|
| excellent | 90-100 | Отличный кандидат |
| good | 75-89 | Хороший кандидат |
| average | 60-74 | Средний кандидат |
| below | 0-59 | Ниже среднего |

### Формула
```
overall = hard_skills×0.40 + experience×0.25 + education×0.15
        + soft_skills×0.10 + languages×0.05 + culture_fit×0.05
```

---

## 11. Интеграции

| Интеграция | Статус | Описание |
|-----------|--------|----------|
| Claude AI (Anthropic) | ✅ Работает | AI анализ резюме |
| Supabase (PostgreSQL) | ✅ Работает | База данных |
| Gmail SMTP | ✅ Работает | Email уведомления |
| Google OAuth | ✅ Работает | Вход через Google |
| LinkedIn OAuth | ✅ Готов | Вход через LinkedIn (нужен Client ID) |
| hh.uz API | ✅ Готов | Публикация вакансий |
| Telegram Bot | ✅ Готов | Уведомления + постинг вакансий |
| Google Forms | ✅ Готов | Создание форм заявки |
| Click/Payme | ⏳ Q2 2026 | Оплата токенов |

---

## 12. Environment Variables

### Backend (.env)
```bash
# Server
NODE_ENV=production
PORT=3001

# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Auth
JWT_SECRET=<64+ random chars>

# Domain
FRONTEND_URL=https://mysolution.uz

# Email
EMAIL_USER=xxx@gmail.com
EMAIL_PASS=<app password>
FROM_EMAIL=xxx@gmail.com

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# LinkedIn OAuth (optional)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# Telegram (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### Frontend (.env.production)
```bash
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

---

## 13. Деплой

### Сервер
- **IP:** 91.213.99.175
- **OS:** Ubuntu 22.04 LTS
- **User:** Mirzabekvokhidov
- **Node:** 22.22.1
- **PM2:** 6.0.14
- **Nginx:** 1.18.0

### Команды деплоя
```bash
# Билд фронтенда
cd frontend && npx vite build

# Загрузка на сервер
scp -r dist/. user@91.213.99.175:/var/www/mysolution/frontend/
rsync -avz --exclude=node_modules --exclude=.env backend/ user@91.213.99.175:/var/www/mysolution/backend/
scp landing/index.html user@91.213.99.175:/var/www/mysolution/landing/

# Перезапуск бэкенда
ssh user@91.213.99.175 "pm2 restart solution-hub"

# Обновление SSL
ssh user@91.213.99.175 "sudo certbot renew"
```

### Мониторинг
```bash
# Статус
ssh user@91.213.99.175 "pm2 status"

# Логи
ssh user@91.213.99.175 "pm2 logs solution-hub --lines 50"

# Health check
curl https://mysolution.uz/health
```

---

## 14. Горячие клавиши

| Комбинация | Действие |
|-----------|----------|
| ⌘/Ctrl + K | Поиск по вакансиям |
| ⌘/Ctrl + N | Новая вакансия |
| Alt + 1 | Вакансии |
| Alt + 2 | Кандидаты |
| Alt + 3 | Интервью |
| Alt + 4 | Аналитика |
| Alt + 5 | Настройки |
| Escape | Закрыть модалку |

---

## 15. Дорожная карта

| Квартал | Статус | Задачи |
|---------|--------|--------|
| Q1 2026 | ✅ Готово | MVP платформы, лендинг, домен, VDS, первые пользователи |
| Q2 2026 | 🔄 В работе | Оплата Click/Payme, Telegram бот, мобильная версия |
| Q3 2026 | 📋 План | Обучение персонала, CRM модуль, 200 клиентов |
| Q4 2026 | 🚀 Цель | Казахстан, Кыргызстан, масштабирование |

---

## 16. Лицензия

Проприетарное ПО. © 2026 SOLUTION. Ташкент, Узбекистан.
Все права защищены.
