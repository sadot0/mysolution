import { motion } from 'framer-motion';
import { usePageTitle } from '../utils/usePageTitle';
import { pageVariants, staggerContainer, staggerItem } from '../utils/animations';
import Layout from '../components/Layout';
import { Building2, Users, BarChart3, Mail, Calendar, ArrowRight } from 'lucide-react';

export default function CRMPage() {
  usePageTitle('CRM');
  const features = [
    { icon: Building2, title: 'Управление клиентами', desc: 'База компаний-клиентов с историей взаимодействий' },
    { icon: Users, title: 'Pipeline сделок', desc: 'Визуальная воронка продаж HR-услуг' },
    { icon: Mail, title: 'Email кампании', desc: 'Автоматические рассылки и follow-up' },
    { icon: Calendar, title: 'Планировщик', desc: 'Встречи, звонки, задачи в одном месте' },
    { icon: BarChart3, title: 'Аналитика продаж', desc: 'Отчёты по выручке, конверсии, LTV' },
  ];

  return (
    <Layout>
      <motion.div variants={pageVariants} initial="initial" animate="animate" className="p-6 md:p-8 page-content">
        <div className="max-w-4xl mx-auto text-center py-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full text-xs font-medium text-purple-400 tracking-wider mb-6">
            COMING SOON
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            Solution <span className="text-purple-400">CRM</span>
          </h1>
          <p className="text-lg text-white/40 max-w-xl mx-auto mb-12">
            Управление клиентами и продажами HR-услуг. Всё в одном месте — от первого контакта до закрытия сделки.
          </p>

          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {features.map(({ icon: Icon, title, desc }) => (
              <motion.div variants={staggerItem} key={title} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 text-left hover:border-[rgba(232,114,28,0.15)] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-1 transition-all duration-300">
                <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                  <Icon size={18} className="text-purple-400" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
                <p className="text-xs text-white/40">{desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 max-w-md mx-auto">
            <p className="text-sm text-white/40 mb-4">Хотите узнать первыми о запуске?</p>
            <div className="flex gap-2">
              <input type="email" placeholder="your@email.com" className="input flex-1 text-sm" />
              <button className="btn-primary px-4 py-2 text-sm">
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}
