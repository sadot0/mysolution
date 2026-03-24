import { useState, useMemo } from 'react';
import { usePageTitle } from '../utils/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Database, Search, Star, StarOff, Filter, Tag, UserPlus, Mail, Phone, Briefcase, MapPin, Trash2, Plus, X, Loader2 } from 'lucide-react';
import Layout from '../components/Layout';
import { pageVariants, staggerContainer, staggerItem } from '../utils/animations';
import { talentPoolApi } from '../utils/api';

interface Talent {
  id: string;
  name: string;
  title: string;
  skills: string[];
  rating: number;
  city: string;
  experience: string;
  lastVacancy: string;
  email: string;
  phone: string;
  favorite: boolean;
  created_at?: string;
}

const ALL_SKILLS = ['React', 'TypeScript', 'CSS', 'Figma', 'Photoshop', 'UI/UX', 'Python', 'Django', 'PostgreSQL', 'Agile', 'Jira', 'Leadership', 'Docker', 'Kubernetes', 'AWS', 'SQL', 'Tableau', 'React Native', 'iOS', 'Selenium', 'JavaScript', 'API Testing'];
const EXPERIENCE_OPTIONS = ['0-1 год', '1-3 года', '3-5 лет', '5+ лет'];
const CITY_OPTIONS = ['Ташкент', 'Самарканд', 'Бухара', 'Remote'];

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase();
}

function getGradient(id: string) {
  const gradients = [
    'from-orange-500 to-amber-500',
    'from-blue-500 to-cyan-500',
    'from-purple-500 to-pink-500',
    'from-emerald-500 to-teal-500',
    'from-rose-500 to-orange-500',
    'from-indigo-500 to-blue-500',
    'from-yellow-500 to-orange-500',
    'from-pink-500 to-purple-500',
  ];
  const num = parseInt(id, 10);
  const idx = isNaN(num) ? id.length : num;
  return gradients[idx % gradients.length];
}

function matchesExperience(exp: string, filter: string): boolean {
  const years = parseInt(exp);
  if (isNaN(years)) return false;
  switch (filter) {
    case '0-1 год': return years <= 1;
    case '1-3 года': return years >= 1 && years <= 3;
    case '3-5 лет': return years >= 3 && years <= 5;
    case '5+ лет': return years >= 5;
    default: return true;
  }
}

// Map backend response to frontend Talent shape
function mapTalent(raw: Record<string, unknown>): Talent {
  const skills = raw.skills;
  return {
    id: String(raw.id),
    name: (raw.name as string) || (raw.full_name as string) || '',
    title: (raw.title as string) || '',
    skills: Array.isArray(skills) ? skills.map(String) : [],
    rating: typeof raw.rating === 'number' ? raw.rating : 0,
    city: (raw.city as string) || '',
    experience: (raw.experience as string) || '',
    lastVacancy: (raw.last_vacancy as string) || (raw.lastVacancy as string) || '',
    email: (raw.email as string) || '',
    phone: (raw.phone as string) || '',
    favorite: Boolean(raw.favorite),
    created_at: (raw.created_at as string) || undefined,
  };
}

export default function TalentPoolPage() {
  usePageTitle('База талантов');
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedExperience, setSelectedExperience] = useState('');
  const [selectedRating, setSelectedRating] = useState(0);
  const [selectedCity, setSelectedCity] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', title: '', skills: '', city: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch talents from API
  const { data: talentsData, isLoading } = useQuery({
    queryKey: ['talent-pool', searchQuery, selectedSkills, selectedExperience, selectedRating, selectedCity],
    queryFn: () =>
      talentPoolApi.list({
        search: searchQuery || undefined,
        skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        min_rating: selectedRating > 0 ? selectedRating : undefined,
        city: selectedCity || undefined,
        experience: selectedExperience || undefined,
      }).then(r => {
        const data = r.data;
        const list = Array.isArray(data) ? data : (data.talents || data.data || []);
        return list.map((t: Record<string, unknown>) => mapTalent(t));
      }),
  });
  const talents: Talent[] = talentsData || [];

  // Update mutation (star rating, favorite)
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      talentPoolApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] });
    },
    onError: () => toast.error('Ошибка обновления кандидата'),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => talentPoolApi.delete(id),
    onSuccess: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] });
    },
    onError: () => toast.error('Ошибка удаления кандидата'),
  });

  // Add mutation
  const addMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => talentPoolApi.add(data),
    onSuccess: () => {
      setShowAddModal(false);
      setAddForm({ name: '', email: '', title: '', skills: '', city: '' });
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] });
    },
    onError: () => toast.error('Ошибка добавления кандидата'),
  });

  // Client-side filtering as fallback (backend may not support all filters)
  const filteredTalents = useMemo(() => {
    return talents.filter(t => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || t.name.toLowerCase().includes(q) || t.title.toLowerCase().includes(q) || t.skills.some(s => s.toLowerCase().includes(q));
      const matchSkills = selectedSkills.length === 0 || selectedSkills.some(s => t.skills.includes(s));
      const matchExp = !selectedExperience || matchesExperience(t.experience, selectedExperience);
      const matchRating = selectedRating === 0 || t.rating >= selectedRating;
      const matchCity = !selectedCity || t.city === selectedCity;
      return matchSearch && matchSkills && matchExp && matchRating && matchCity;
    });
  }, [talents, searchQuery, selectedSkills, selectedExperience, selectedRating, selectedCity]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    return {
      total: talents.length,
      favorites: talents.filter(t => t.favorite).length,
      highRated: talents.filter(t => t.rating >= 4).length,
      recentMonth: talents.filter(t => t.created_at && new Date(t.created_at) >= monthAgo).length,
    };
  }, [talents]);

  const toggleFavorite = (talent: Talent) => {
    updateMutation.mutate({ id: talent.id, data: { favorite: !talent.favorite } });
  };

  const handleRatingClick = (talent: Talent, newRating: number) => {
    const rating = talent.rating === newRating ? 0 : newRating;
    updateMutation.mutate({ id: talent.id, data: { rating } });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleAdd = () => {
    const skillsArr = addForm.skills.split(',').map(s => s.trim()).filter(Boolean);
    addMutation.mutate({
      name: addForm.name,
      email: addForm.email,
      title: addForm.title,
      skills: skillsArr,
      city: addForm.city,
    });
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
  };

  const clearFilters = () => {
    setSelectedSkills([]);
    setSelectedExperience('');
    setSelectedRating(0);
    setSelectedCity('');
  };

  const hasActiveFilters = selectedSkills.length > 0 || selectedExperience || selectedRating > 0 || selectedCity;

  return (
    <Layout>
      <motion.div className="p-6 md:p-8 page-content" variants={pageVariants} initial="initial" animate="animate" exit="exit">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
              <Database size={18} className="text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">БАЗА ТАЛАНТОВ</h1>
              <p className="text-xs text-white/40">Сохранённые кандидаты для будущих вакансий</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-2 text-sm px-4 py-2.5"
            >
              <Plus size={14} />
              Добавить в базу
            </button>
            <div className="relative flex-1 md:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Поиск по имени, должности, навыкам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10 w-full text-sm"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                showFilters || hasActiveFilters
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                  : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:border-white/[0.08]'
              }`}
            >
              <Filter size={14} />
              Фильтры
              {hasActiveFilters && (
                <span className="w-5 h-5 bg-orange-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                  {selectedSkills.length + (selectedExperience ? 1 : 0) + (selectedRating > 0 ? 1 : 0) + (selectedCity ? 1 : 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Всего в базе', value: stats.total, color: 'text-white' },
            { label: 'Избранные', value: stats.favorites, color: 'text-yellow-400' },
            { label: 'С высоким рейтингом', value: stats.highRated, color: 'text-orange-400' },
            { label: 'Добавлено за месяц', value: stats.recentMonth, color: 'text-emerald-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-white/[0.03] border border-white/[0.04] rounded-2xl p-4 backdrop-blur-xl">
              <p className="text-xs text-white/40 mb-1">{stat.label}</p>
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white/[0.03] border border-white/[0.04] rounded-2xl p-5 mb-6 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Фильтры</h3>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
                  Сбросить все
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Skills */}
              <div>
                <label className="label text-xs mb-2 flex items-center gap-1.5">
                  <Tag size={12} />
                  Навыки
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {ALL_SKILLS.map(skill => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                        selectedSkills.includes(skill)
                          ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:border-white/[0.08]'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              {/* Experience */}
              <div>
                <label className="label text-xs mb-2 flex items-center gap-1.5">
                  <Briefcase size={12} />
                  Опыт
                </label>
                <div className="flex flex-col gap-1.5">
                  {EXPERIENCE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setSelectedExperience(selectedExperience === opt ? '' : opt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border text-left transition-all ${
                        selectedExperience === opt
                          ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:border-white/[0.08]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div>
                <label className="label text-xs mb-2 flex items-center gap-1.5">
                  <Star size={12} />
                  Минимальный рейтинг
                </label>
                <div className="flex flex-col gap-1.5">
                  {[5, 4, 3, 2, 1].map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedRating(selectedRating === r ? 0 : r)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border text-left transition-all ${
                        selectedRating === r
                          ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:border-white/[0.08]'
                      }`}
                    >
                      <span className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={10} className={i < r ? 'text-yellow-400 fill-yellow-400' : 'text-white/25'} />
                        ))}
                      </span>
                      {r}+ звёзд
                    </button>
                  ))}
                </div>
              </div>

              {/* City */}
              <div>
                <label className="label text-xs mb-2 flex items-center gap-1.5">
                  <MapPin size={12} />
                  Город / Remote
                </label>
                <div className="flex flex-col gap-1.5">
                  {CITY_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setSelectedCity(selectedCity === c ? '' : c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border text-left transition-all ${
                        selectedCity === c
                          ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:border-white/[0.08]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 size={32} className="text-orange-400 animate-spin mb-4" />
            <p className="text-sm text-white/40">Загрузка базы талантов...</p>
          </div>
        ) : filteredTalents.length > 0 ? (
          /* Talent grid */
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {filteredTalents.map(talent => (
              <motion.div
                key={talent.id}
                variants={staggerItem}
                className="bg-white/[0.03] border border-white/[0.04] rounded-2xl p-5 hover:border-white/[0.06] transition-all group backdrop-blur-xl"
              >
                {/* Top row: avatar + name + favorite */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${getGradient(talent.id)} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                      {getInitials(talent.name)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white leading-tight">{talent.name}</h3>
                      <p className="text-xs text-white/40">{talent.title}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFavorite(talent)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.02] transition-colors"
                    disabled={updateMutation.isPending}
                  >
                    {talent.favorite ? (
                      <Star size={16} className="text-yellow-400 fill-yellow-400" />
                    ) : (
                      <StarOff size={16} className="text-white/25 hover:text-white/60" />
                    )}
                  </button>
                </div>

                {/* Rating (clickable) */}
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handleRatingClick(talent, i + 1)}
                      className="hover:scale-125 transition-transform"
                      disabled={updateMutation.isPending}
                    >
                      <Star size={12} className={i < talent.rating ? 'text-yellow-400 fill-yellow-400' : 'text-neutral-700 hover:text-yellow-400/50'} />
                    </button>
                  ))}
                  <span className="text-xs text-white/40 ml-1">{talent.rating}/5</span>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {talent.skills.map(skill => (
                    <span key={skill} className="px-2 py-0.5 bg-white/[0.02] border border-white/[0.06] rounded-md text-[11px] text-white/60 font-medium">
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Info rows */}
                <div className="space-y-1.5 mb-4">
                  {talent.experience && (
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <Briefcase size={11} className="shrink-0" />
                      <span>{talent.experience}</span>
                    </div>
                  )}
                  {talent.city && (
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <MapPin size={11} className="shrink-0" />
                      <span>{talent.city}</span>
                    </div>
                  )}
                  {talent.email && (
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <Mail size={11} className="shrink-0" />
                      <span>{talent.email}</span>
                    </div>
                  )}
                  {talent.phone && (
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <Phone size={11} className="shrink-0" />
                      <span>{talent.phone}</span>
                    </div>
                  )}
                </div>

                {/* Last vacancy */}
                {talent.lastVacancy && (
                  <div className="bg-white/[0.02]/50 border border-white/[0.06]/50 rounded-lg px-3 py-2 mb-4">
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-0.5">Последняя вакансия</p>
                    <p className="text-xs text-neutral-300 font-medium">{talent.lastVacancy}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 flex items-center justify-center gap-2 text-xs py-2.5">
                    <UserPlus size={13} />
                    Пригласить на вакансию
                  </button>
                  <button
                    onClick={() => setDeletingId(talent.id)}
                    className="px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/40 hover:text-red-400 hover:border-red-500/30 transition-all"
                    title="Удалить из базы"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.04] rounded-2xl flex items-center justify-center mb-4">
              <Database size={24} className="text-white/25" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">База талантов пуста</h3>
            <p className="text-sm text-white/40 max-w-sm">
              {searchQuery || hasActiveFilters
                ? 'По выбранным фильтрам ничего не найдено. Попробуйте изменить параметры поиска.'
                : 'Кандидаты автоматически добавляются после анализа. Вы также можете добавить кандидата вручную.'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-4 text-sm text-orange-400 hover:text-orange-300 transition-colors">
                Сбросить фильтры
              </button>
            )}
            {!hasActiveFilters && !searchQuery && (
              <button onClick={() => setShowAddModal(true)} className="btn-primary mt-4 flex items-center gap-2 text-sm px-5 py-2.5">
                <Plus size={14} />
                Добавить в базу
              </button>
            )}
          </div>
        )}

        {/* Delete confirmation modal */}
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 w-full max-w-sm mx-4 backdrop-blur-xl">
              <h3 className="text-lg font-bold text-white mb-2">Удалить из базы?</h3>
              <p className="text-sm text-white/60 mb-6">Кандидат будет удалён из базы талантов. Это действие нельзя отменить.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="btn-secondary flex-1 text-sm"
                  disabled={deleteMutation.isPending}
                >
                  Отмена
                </button>
                <button
                  onClick={() => handleDelete(deletingId)}
                  className="btn-danger flex-1 text-sm flex items-center justify-center gap-2"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Удалить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add talent modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 w-full max-w-md mx-4 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">Добавить в базу</h3>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.02] transition-colors text-white/60">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label text-xs mb-1.5">Имя *</label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    placeholder="Иван Иванов"
                    value={addForm.name}
                    onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-xs mb-1.5">Email *</label>
                  <input
                    type="email"
                    className="input w-full text-sm"
                    placeholder="email@example.com"
                    value={addForm.email}
                    onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-xs mb-1.5">Должность</label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    placeholder="Frontend Developer"
                    value={addForm.title}
                    onChange={e => setAddForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-xs mb-1.5">Навыки (через запятую)</label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    placeholder="React, TypeScript, CSS"
                    value={addForm.skills}
                    onChange={e => setAddForm(prev => ({ ...prev, skills: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-xs mb-1.5">Город</label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    placeholder="Ташкент"
                    value={addForm.city}
                    onChange={e => setAddForm(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1 text-sm"
                  disabled={addMutation.isPending}
                >
                  Отмена
                </button>
                <button
                  onClick={handleAdd}
                  className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
                  disabled={!addForm.name || !addForm.email || addMutation.isPending}
                >
                  {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Добавить
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
