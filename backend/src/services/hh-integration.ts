const HH_API_BASE = 'https://api.hh.ru';

// Map experience years to HH format
function mapExperience(years: number): string {
  if (years <= 0) return 'noExperience';
  if (years <= 1) return 'between1And3';
  if (years <= 3) return 'between3And6';
  return 'moreThan6';
}

// Publish vacancy to HH
export async function publishToHH(
  accessToken: string,
  vacancy: {
    title: string;
    description: string;
    location?: string;
    salary_min?: number;
    salary_max?: number;
    experience_years?: number;
    remote?: boolean;
  }
): Promise<{ success: boolean; hh_vacancy_id?: string; hh_url?: string; error?: string }> {
  try {
    // Default area: Tashkent = 2759
    const areaId = '2759';

    const hhData: Record<string, unknown> = {
      name: vacancy.title,
      description: `<p>${vacancy.description || vacancy.title}</p>`,
      area: { id: areaId },
      experience: { id: mapExperience(vacancy.experience_years || 0) },
      schedule: { id: vacancy.remote ? 'remote' : 'fullDay' },
      employment: { id: 'full' },
    };

    if (vacancy.salary_min || vacancy.salary_max) {
      hhData.salary = {
        from: vacancy.salary_min || undefined,
        to: vacancy.salary_max || undefined,
        currency: 'UZS',
        gross: false,
      };
    }

    const res = await fetch(`${HH_API_BASE}/vacancies`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SOLUTION-HR/2.1 (info@mysolution.uz)',
      },
      body: JSON.stringify(hhData),
    });

    if (res.status === 201) {
      const location = res.headers.get('location');
      const hhId = location?.split('/').pop();
      return {
        success: true,
        hh_vacancy_id: hhId,
        hh_url: `https://hh.uz/vacancy/${hhId}`,
      };
    }

    const errorBody = await res.text();
    console.error('[HH] Publish failed:', res.status, errorBody);
    return { success: false, error: `HH API error: ${res.status}` };
  } catch (err) {
    console.error('[HH] Error:', err);
    return { success: false, error: 'Ошибка подключения к HH' };
  }
}

// Get employer vacancies
export async function getHHVacancies(accessToken: string): Promise<unknown[]> {
  try {
    const res = await fetch(`${HH_API_BASE}/vacancies/active`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'SOLUTION-HR/2.1',
      },
    });
    if (!res.ok) return [];
    const data = await res.json() as { items?: unknown[] };
    return data.items || [];
  } catch {
    return [];
  }
}
