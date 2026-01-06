import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = 48;
  const offset = (page - 1) * pageSize;

  // Fetch cards with pagination
  const { data: cards, count } = await locals.supabase
    .from('cards')
    .select('*', { count: 'exact' })
    .order('card_name', { ascending: true })
    .range(offset, offset + pageSize - 1);

  // Fetch unique set codes for filter dropdown
  const { data: setsData } = await locals.supabase
    .from('cards')
    .select('set_code, set_name')
    .not('set_code', 'is', null);

  // Deduplicate sets
  const setsMap = new Map<string, string>();
  setsData?.forEach((s) => {
    if (s.set_code && s.set_name) {
      setsMap.set(s.set_code, s.set_name);
    }
  });

  const sets = Array.from(setsMap.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    cards: cards || [],
    sets,
    pagination: {
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize)
    }
  };
};
