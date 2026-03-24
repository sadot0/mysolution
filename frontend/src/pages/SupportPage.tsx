import { useState } from 'react';
import { usePageTitle } from '../utils/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  HelpCircle, Plus, MessageSquare, Bug, Lightbulb, HelpCircle as QuestionIcon,
  CreditCard, MoreHorizontal, Clock, CheckCircle2, Loader2, Send,
  X,
} from 'lucide-react';
import Layout from '../components/Layout';
import { supportApi } from '../utils/api';
import { pageVariants, staggerContainer, staggerItem } from '../utils/animations';
import { SupportTicket } from '../types';

type TicketCategory = 'bug' | 'feature' | 'question' | 'billing' | 'other';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

const CATEGORY_CONFIG: Record<TicketCategory, { label: string; icon: typeof Bug; color: string }> = {
  bug: { label: 'Ошибка', icon: Bug, color: 'text-red-400' },
  feature: { label: 'Идея', icon: Lightbulb, color: 'text-yellow-400' },
  question: { label: 'Вопрос', icon: QuestionIcon, color: 'text-blue-400' },
  billing: { label: 'Оплата', icon: CreditCard, color: 'text-green-400' },
  other: { label: 'Другое', icon: MoreHorizontal, color: 'text-white/60' },
};

const STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; text: string }> = {
  open: { label: 'Открыт', bg: 'bg-orange-500/20', text: 'text-orange-400' },
  in_progress: { label: 'В работе', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  resolved: { label: 'Решён', bg: 'bg-green-500/20', text: 'text-green-400' },
  closed: { label: 'Закрыт', bg: 'bg-neutral-500/20', text: 'text-white/60' },
};

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: 'Низкий', color: 'text-white/60 border-neutral-600' },
  medium: { label: 'Средний', color: 'text-blue-400 border-blue-600' },
  high: { label: 'Высокий', color: 'text-orange-400 border-orange-600' },
  urgent: { label: 'Срочный', color: 'text-red-400 border-red-600' },
};

const modalOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const modalContent = {
  initial: { opacity: 0, scale: 0.92, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] as const } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } },
};

export default function SupportPage() {
  usePageTitle('Поддержка');
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');

  const { data: tickets, isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['support-tickets'],
    queryFn: () => supportApi.getMyTickets().then((r) => r.data.tickets ?? r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { category: string; subject: string; message: string; priority: string }) =>
      supportApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Обращение отправлено!');
      closeModal();
    },
    onError: () => {
      toast.error('Ошибка при отправке обращения');
    },
  });

  const closeModal = () => {
    setShowModal(false);
    setCategory(null);
    setSubject('');
    setMessage('');
    setPriority('medium');
  };

  const handleSubmit = () => {
    if (!category) {
      toast.error('Выберите категорию');
      return;
    }
    if (!subject.trim()) {
      toast.error('Введите тему обращения');
      return;
    }
    if (!message.trim()) {
      toast.error('Введите сообщение');
      return;
    }
    createMutation.mutate({ category, subject: subject.trim(), message: message.trim(), priority });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Layout>
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wide flex items-center gap-3">
              <HelpCircle className="w-8 h-8 text-orange-400" />
              ПОДДЕРЖКА
            </h1>
            <p className="text-white/60 mt-1">Свяжитесь с нами по любому вопросу</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Новое обращение
          </button>
        </div>

        {/* Ticket list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          </div>
        ) : !tickets || tickets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <MessageSquare className="w-16 h-16 text-white/25 mx-auto mb-4" />
            <p className="text-white/60 text-lg">У вас пока нет обращений</p>
            <p className="text-white/40 text-sm mt-1">
              Нажмите &laquo;Новое обращение&raquo;, чтобы связаться с нами
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-4"
          >
            {tickets.map((ticket) => {
              const catConf = CATEGORY_CONFIG[ticket.category] || CATEGORY_CONFIG.other;
              const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
              const CatIcon = catConf.icon;

              return (
                <motion.div
                  key={ticket.id}
                  variants={staggerItem}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.08] transition-colors backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`mt-0.5 ${catConf.color}`}>
                        <CatIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-white font-semibold truncate">{ticket.subject}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusConf.bg} ${statusConf.text}`}>
                            {statusConf.label}
                          </span>
                        </div>
                        <p className="text-white/60 text-sm line-clamp-2">{ticket.message}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(ticket.created_at)}
                          </span>
                          <span className={`${catConf.color} opacity-70`}>{catConf.label}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Admin reply */}
                  {ticket.admin_reply && (
                    <div className="mt-4 ml-8 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-orange-400" />
                        <span className="text-orange-400 text-xs font-medium">Ответ поддержки</span>
                      </div>
                      <p className="text-neutral-300 text-sm">{ticket.admin_reply}</p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Create ticket modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              variants={modalOverlay}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
            >
              <motion.div
                variants={modalContent}
                initial="initial"
                animate="animate"
                exit="exit"
                className="bg-white/[0.03] border border-white/[0.06] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto backdrop-blur-xl"
              >
                <div className="p-6">
                  {/* Modal header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Новое обращение</h2>
                    <button onClick={closeModal} className="text-white/60 hover:text-white transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Category selector */}
                  <div className="mb-5">
                    <label className="label mb-2 block">Категория</label>
                    <div className="grid grid-cols-5 gap-2">
                      {(Object.entries(CATEGORY_CONFIG) as [TicketCategory, typeof CATEGORY_CONFIG[TicketCategory]][]).map(
                        ([key, conf]) => {
                          const Icon = conf.icon;
                          const isActive = category === key;
                          return (
                            <button
                              key={key}
                              onClick={() => setCategory(key)}
                              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center ${
                                isActive
                                  ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                                  : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:border-white/[0.08] hover:text-neutral-300'
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                              <span className="text-xs font-medium">{conf.label}</span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="mb-5">
                    <label className="label mb-2 block">Тема</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Кратко опишите проблему"
                      className="input w-full"
                    />
                  </div>

                  {/* Message */}
                  <div className="mb-5">
                    <label className="label mb-2 block">Сообщение</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Подробно опишите ваш вопрос или проблему..."
                      rows={5}
                      className="input w-full resize-none"
                    />
                  </div>

                  {/* Priority */}
                  <div className="mb-6">
                    <label className="label mb-2 block">Приоритет</label>
                    <div className="flex gap-2">
                      {(Object.entries(PRIORITY_CONFIG) as [TicketPriority, typeof PRIORITY_CONFIG[TicketPriority]][]).map(
                        ([key, conf]) => (
                          <button
                            key={key}
                            onClick={() => setPriority(key)}
                            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                              priority === key
                                ? `${conf.color} bg-white/[0.02]`
                                : 'border-white/[0.06] text-white/40 hover:text-white/60 hover:border-white/[0.08]'
                            }`}
                          >
                            {conf.label}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    {createMutation.isPending ? 'Отправка...' : 'Отправить'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Layout>
  );
}
