import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // Fetch ALL cards for client-side filtering/pagination
  // For ~7000 cards, this is acceptable. For larger catalogs, use server-side filtering.
  const { data: cards, error } = await locals.supabase
    .from('cards')
    .select('*')
    .order('card_name', { ascending: true });

  if (error) {
    console.error('Error fetching cards:', error);
  }

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
    sets
  };
};
