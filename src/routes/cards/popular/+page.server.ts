import { createAdminClient } from '$lib/server/admin'
import { logger } from '$lib/server/logger'

export interface PopularCard {
	rank: number
	card_name: string
	total_copies: number
	distinct_orders: number
	card_id: string | null
	scryfall_id: string | null
	card_type: string | null
	foil_type: string | null
	set_name: string | null
	set_code: string | null
	collector_number: string | null
	mana_cost: string | null
	type_line: string | null
	is_in_stock: boolean
}

export const load = async ({ url, setHeaders }: { url: URL; setHeaders: (headers: Record<string, string>) => void }) => {
	setHeaders({ 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' })

	const adminClient = createAdminClient()

	// Parse group buy filter from URL
	const groupBuyFilter = url.searchParams.get('groupBuy') || null

	// --- Fetch group buys for filter dropdown ---
	const { data: groupBuys, error: gbError } = await adminClient
		.from('group_buy_config')
		.select('id, name, is_active, created_at, opens_at, closes_at')
		.order('created_at', { ascending: false })

	if (gbError) {
		logger.error({ error: gbError }, 'Failed to fetch group buys for popular page')
	}

	// --- Fetch all non-cancelled order_items ---
	// We use the admin client to bypass RLS — no PII is returned (only card_name, quantity, card_id)
	let itemQuery = adminClient
		.from('order_items')
		.select(
			`
      card_name,
      quantity,
      card_id,
      order_id,
      orders!inner(group_buy_id, status)
    `
		)
		.neq('orders.status', 'cancelled')

	if (groupBuyFilter) {
		itemQuery = itemQuery.eq('orders.group_buy_id', groupBuyFilter)
	}

	const { data: rawItems, error: itemsError } = await itemQuery

	if (itemsError) {
		logger.error({ error: itemsError, groupBuyFilter }, 'Failed to fetch order items for popular page')
		return {
			popularCards: [] as PopularCard[],
			groupBuys: groupBuys ?? [],
			groupBuyFilter
		}
	}

	// --- Aggregate in JS: group by card_name ---
	// Combines all finishes of the same card name into one entry
	const aggregateMap = new Map<
		string,
		{
			card_name: string
			total_copies: number
			order_ids: Set<string>
			card_id: string | null
		}
	>()

	for (const item of rawItems ?? []) {
		const key = item.card_name
		const existing = aggregateMap.get(key)
		if (existing) {
			existing.total_copies += item.quantity ?? 1
			existing.order_ids.add(item.order_id)
			// Keep first non-null card_id we encounter
			if (!existing.card_id && item.card_id) {
				existing.card_id = item.card_id
			}
		} else {
			aggregateMap.set(key, {
				card_name: item.card_name,
				total_copies: item.quantity ?? 1,
				order_ids: new Set([item.order_id]),
				card_id: item.card_id ?? null
			})
		}
	}

	// Sort by total_copies desc, take top 200
	const ranked = [...aggregateMap.values()]
		.map((e) => ({
			card_name: e.card_name,
			total_copies: e.total_copies,
			distinct_orders: e.order_ids.size,
			card_id: e.card_id
		}))
		.sort((a, b) => b.total_copies - a.total_copies)
		.slice(0, 200)

	// --- Fetch card display data for top 200 card_ids ---
	const cardIds = ranked.map((r) => r.card_id).filter((id): id is string => id !== null)

	type CardRow = {
		id: string
		scryfall_id: string | null
		card_type: string | null
		foil_type: string | null
		set_name: string | null
		set_code: string | null
		collector_number: string | null
		mana_cost: string | null
		type_line: string | null
		is_in_stock: boolean | null
	}
	let cardMap = new Map<string, CardRow>()

	if (cardIds.length > 0) {
		const { data: cardDetails, error: cardsError } = await adminClient
			.from('cards')
			.select('id, scryfall_id, card_type, foil_type, set_name, set_code, collector_number, mana_cost, type_line, is_in_stock')
			.in('id', cardIds)

		if (cardsError) {
			logger.error({ error: cardsError }, 'Failed to fetch card details for popular page')
		} else {
			cardMap = new Map((cardDetails ?? []).map((c) => [c.id, c as CardRow]))
		}
	}


	// --- Merge card details into ranked list ---
	const popularCards: PopularCard[] = ranked.map((r, i) => {
		const card = r.card_id ? cardMap.get(r.card_id) : null
		return {
			rank: i + 1,
			card_name: r.card_name,
			total_copies: r.total_copies,
			distinct_orders: r.distinct_orders,
			card_id: r.card_id,
			scryfall_id: card?.scryfall_id ?? null,
			card_type: card?.card_type ?? null,
			foil_type: card?.foil_type ?? null,
			set_name: card?.set_name ?? null,
			set_code: card?.set_code ?? null,
			collector_number: card?.collector_number ?? null,
			mana_cost: card?.mana_cost ?? null,
			type_line: card?.type_line ?? null,
			is_in_stock: card?.is_in_stock ?? false
		}
	})

	return {
		popularCards,
		groupBuys: groupBuys ?? [],
		groupBuyFilter
	}
}
