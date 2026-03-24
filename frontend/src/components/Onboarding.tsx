import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BriefcaseIcon, Users, BarChart3, Sparkles, ArrowRight,
  CheckCircle, X, Coins, Brain
} from 'lucide-react';

interface OnboardingProps {
  userName: string;
  onComplete: () => void;
}

const STEPS = [
  {
    title: 'Добро пожаловать в SOLUTION!',
    description: 'Давайте покажем как работает AI Рекрутер. Это займёт 30 секунд.',
    icon: Sparkles,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  {
    title: 'Создайте вакансию',
    description: 'Выберите из 6 готовых шаблонов (разработчик, дизайнер, SMM и др.) или создайте свою. AI подготовит идеальную анкету.',
    icon: BriefcaseIcon,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    title: 'Получайте кандидатов',
    description: 'Поделитесь ссылкой или QR-кодом. Кандидаты заполнят анкету и загрузят резюме. Или загрузите до 100 резюме разом.',
    icon: Users,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    title: 'AI анализирует за 30 секунд',
    description: 'Claude AI оценивает каждого кандидата по 6 параметрам: навыки, опыт, образование, soft skills, языки, culture fit.',
    icon: Brain,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    title: 'Управляйте и нанимайте',
    description: 'Kanban-доска, сравнение кандидатов, PDF отчёты, автоматические email приглашения. Всё в одном месте.',
    icon: BarChart3,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    title: 'Ваши 100 бесплатных токенов',
    description: 'Мы подарили вам 100 токенов — хватит на 10 AI анализов. Когда закончатся — пополните в Настройках.',
    icon: Coins,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
];

export default function Onboarding({ userName, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Card */}
      <motion.div
        className="relative w-full max-w-md bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Skip button */}
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-white/25 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
        >
          <X size={16} />
        </button>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-6 pb-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-orange-500' : i < step ? 'w-1.5 bg-orange-500/50' : 'w-1.5 bg-white/[0.06]'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="px-8 py-6 text-center"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Icon */}
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${current.bg} mb-5`}>
              <current.icon size={28} className={current.color} />
            </div>

            {/* Greeting on first step */}
            {step === 0 && (
              <p className="text-sm text-orange-400 font-medium mb-2">
                Привет, {userName.split(' ')[0]}!
              </p>
            )}

            <h2 className="text-xl font-bold text-white mb-3">{current.title}</h2>
            <p className="text-sm text-white/60 leading-relaxed">{current.description}</p>
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="px-8 pb-6 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-white/60 bg-white/[0.02] border border-white/[0.06] hover:text-white hover:border-white/[0.08] transition-colors"
            >
              Назад
            </button>
          )}
          <button
            onClick={() => {
              if (isLast) {
                onComplete();
              } else {
                setStep(s => s + 1);
              }
            }}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            {isLast ? (
              <>
                <CheckCircle size={16} />
                Начать работу
              </>
            ) : (
              <>
                Далее
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
