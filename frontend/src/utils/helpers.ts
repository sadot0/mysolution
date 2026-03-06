export function getCategoryColor(category: string): string {
  switch (category) {
    case 'excellent': return 'text-emerald-400';
    case 'good': return 'text-blue-400';
    case 'average': return 'text-yellow-400';
    case 'below': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

export function getCategoryBg(category: string): string {
  switch (category) {
    case 'excellent': return 'bg-emerald-500';
    case 'good': return 'bg-blue-500';
    case 'average': return 'bg-yellow-500';
    case 'below': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

export function getCategoryLabel(category: string): string {
  switch (category) {
    case 'excellent': return 'Отличный';
    case 'good': return 'Хороший';
    case 'average': return 'Средний';
    case 'below': return 'Ниже среднего';
    default: return category;
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'new': return 'Новый';
    case 'analyzing': return 'Анализ...';
    case 'analyzed': return 'Проанализирован';
    case 'invited': return 'Приглашён';
    case 'rejected': return 'Отклонён';
    case 'error': return 'Ошибка';
    default: return status;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'new': return 'text-gray-400';
    case 'analyzing': return 'text-blue-400 animate-pulse';
    case 'analyzed': return 'text-emerald-400';
    case 'invited': return 'text-purple-400';
    case 'rejected': return 'text-red-400';
    case 'error': return 'text-orange-400';
    default: return 'text-gray-400';
  }
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
