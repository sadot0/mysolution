import { motion } from 'framer-motion';
import { usePageTitle } from '../utils/usePageTitle';
import { pageVariants, staggerContainer, staggerItem } from '../utils/animations';
import Layout from '../components/Layout';
import { BookOpen, Video, ClipboardCheck, Award, TrendingUp, ArrowRight } from 'lucide-react';

export default function LMSPage() {
  usePageTitle('Обучение');
  const features = [
    { icon: BookOpen, title: 'Курсы и программы', desc: 'Создание учебных программ с модулями и уроками' },
    { icon: Video, title: 'Видео уроки', desc: 'Встроенный видеоплеер с отслеживанием просмотров' },
    { icon: ClipboardCheck, title: 'Тесты и экзамены', desc: 'Автоматическая проверка знаний и оценка' },
    { icon: Award, title: 'Сертификаты', desc: 'Автоматическая выдача сертификатов по завершении' },
    { icon: TrendingUp, title: 'Прогресс сотрудников', desc: 'Отслеживание обучения и развития команды' },
  ];

  return (
    <Layout>
      <motion.div variants={pageVariants} initial="initial" animate="animate" className="p-6 md:p-8 page-content">
        <div className="max-w-4xl mx-auto text-center py-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-medium text-emerald-400 tracking-wider mb-6">
            COMING SOON
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            Solution <span className="text-emerald-400">LMS</span>
          </h1>
          <p className="text-lg text-neutral-400 max-w-xl mx-auto mb-12">
            Обучение и развитие сотрудников. Курсы, тесты, сертификаты — всё для роста вашей команды.
          </p>

          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {features.map(({ icon: Icon, title, desc }) => (
              <motion.div variants={staggerItem} key={title} className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 text-left hover:border-emerald-500/30 transition-colors">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center mb-4">
                  <Icon size={18} className="text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
                <p className="text-xs text-neutral-500">{desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-8 max-w-md mx-auto">
            <p className="text-sm text-neutral-400 mb-4">Хотите узнать первыми о запуске?</p>
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
