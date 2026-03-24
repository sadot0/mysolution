import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePageTitle } from '../utils/usePageTitle';
import { pageVariants, staggerContainer, staggerItem } from '../utils/animations';
import Layout from '../components/Layout';
import {
  Building2, Users, BarChart3, Mail, Calendar, ArrowRight,
  MessageSquare, Target, Globe, Zap, Shield, Clock
} from 'lucide-react';

const features = [
  {
    icon: Building2,
    title: 'Управление клиентами',
    desc: 'Полная база компаний-клиентов с историей взаимодействий, контактами и заметками. Никогда не теряйте контекст.',
    color: 'purple',
  },
  {
    icon: Target,
    title: 'Pipeline сделок',
    desc: 'Визуальная воронка продаж HR-услуг с drag-and-drop. Отслеживайте каждую сделку от первого касания до закрытия.',
    color: 'blue',
  },
  {
    icon: Mail,
    title: 'Email кампании',
    desc: 'Автоматические рассылки, follow-up цепочки и персонализированные шаблоны. Интеграция с Gmail и Outlook.',
    color: 'emerald',
  },
  {
    icon: Calendar,
    title: 'Планировщик задач',
    desc: 'Встречи, звонки, задачи и дедлайны в одном месте. Синхронизация с Google Calendar и уведомления.',
    color: 'orange',
  },
  {
    icon: BarChart3,
    title: 'Аналитика продаж',
    desc: 'Детальные отчёты по выручке, конверсии воронки, LTV клиентов и эффективности менеджеров.',
    color: 'yellow',
  },
  {
    icon: MessageSquare,
    title: 'Чат и коммуникации',
    desc: 'Встроенный мессенджер для команды. История переписки с клиентами, комментарии к сделкам.',
    color: 'pink',
  },
];

const highlights = [
  { icon: Zap, label: 'AI-рекомендации по сделкам' },
  { icon: Globe, label: 'Мультиязычный интерфейс' },
  { icon: Shield, label: 'GDPR-совместимость' },
  { icon: Clock, label: 'Автоматизация рутины' },
  { icon: Users, label: 'До 50 пользователей' },
  { icon: Target, label: 'Интеграция с ATS' },
];

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400' },
  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-400' },
};

export default function CRMPage() {
  usePageTitle('CRM');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
      setEmail('');
    }
  };

  return (
    <Layout>
      <motion.div variants={pageVariants} initial="initial" animate="animate" className="p-4 sm:p-6 lg:p-8 page-content">
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full text-xs font-medium text-purple-400 tracking-wider mb-6"
            >
              COMING SOON
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black text-white mb-4"
            >
              Solution <span className="text-purple-400">CRM</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-white/40 max-w-2xl mx-auto mb-4"
            >
              Управление клиентами и продажами HR-услуг. Всё в одном месте — от первого контакта до закрытия сделки.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] text-sm text-white/60"
            >
              <Clock size={14} className="text-purple-400" />
              Ожидаемый запуск: Q3 2026
            </motion.div>
          </div>

          {/* Feature Cards */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10"
          >
            {features.map(({ icon: Icon, title, desc, color }) => {
              const c = colorMap[color];
              return (
                <motion.div
                  variants={staggerItem}
                  key={title}
                  className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 text-left hover:border-white/[0.12] hover:bg-white/[0.05] hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className={`w-11 h-11 ${c.bg} border ${c.border} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon size={18} className={c.text} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
                  <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 sm:p-8 mb-10"
          >
            <h2 className="text-base font-semibold text-white mb-5 text-center">Также в комплекте</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {highlights.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center"
                >
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Icon size={16} className="text-purple-400" />
                  </div>
                  <span className="text-[11px] text-white/60 font-medium leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Email Signup */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 max-w-lg mx-auto text-center"
          >
            <h3 className="text-base font-semibold text-white mb-2">Узнайте первыми о запуске</h3>
            <p className="text-xs text-white/40 mb-5">
              Оставьте email — мы пришлём уведомление, как только CRM будет готов к использованию.
            </p>

            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center gap-2 py-3 text-sm text-emerald-400"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <ArrowRight size={12} className="text-emerald-400" />
                </div>
                Спасибо! Мы уведомим вас о запуске.
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input flex-1 text-sm"
                  required
                />
                <button type="submit" className="btn-primary px-5 py-2 text-sm flex items-center gap-2">
                  Подписаться
                  <ArrowRight size={14} />
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </motion.div>
    </Layout>
  );
}
