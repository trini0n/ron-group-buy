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

// Server-side cache for Scryfall symbol map (symbol → svg_uri)
// Populated once per process restart; safe to cache indefinitely (symbols are static)
let symbolMapCache: Record<string, string> | null = null

async function fetchSymbolMap(): Promise<Record<string, string>> {
	if (symbolMapCache) return symbolMapCache
	try {
		const res = await fetch('https://api.scryfall.com/symbology', {
			headers: { 'User-Agent': 'RonGroupBuy/1.0' }
		})
		if (!res.ok) return {}
		const json = await res.json()
		const map: Record<string, string> = {}
		for (const sym of json.data ?? []) {
			if (sym.symbol && sym.svg_uri) {
				map[sym.symbol] = sym.svg_uri
			}
		}
		symbolMapCache = map
		return map
	} catch {
		return {}
	}
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

	// --- Fetch all order_items with their order status ---
	// We fetch ALL statuses and filter in JS (filtering on joined tables in PostgREST
	// can silently return wrong results — JS filter is reliable and explicit).
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

	if (groupBuyFilter) {
		itemQuery = itemQuery.eq('orders.group_buy_id', groupBuyFilter)
	}

	const { data: rawItemsAll, error: itemsError } = await itemQuery

	if (itemsError) {
		logger.error({ error: itemsError, groupBuyFilter }, 'Failed to fetch order items for popular page')
		return {
			popularCards: [] as PopularCard[],
			groupBuys: groupBuys ?? [],
			groupBuyFilter,
			symbolMap: {} as Record<string, string>
		}
	}

	// Filter out cancelled orders in JS — reliable and transparent
	const rawItems = (rawItemsAll ?? []).filter((item) => {
		const orders = item.orders
		// orders is an object (single row via !inner join)
		const status = Array.isArray(orders) ? orders[0]?.status : (orders as { status: string } | null)?.status
		return status !== 'cancelled'
	})

	// --- Aggregate in JS: group by card_name ---
	// Combines all finishes/printings of the same card name into one entry.
	// Collects ALL card_ids seen for each name so we can later pick the one
	// whose linked card row name actually matches (guards against order_items
	// rows where card_name and card_id disagree due to data entry errors).
	const aggregateMap = new Map<
		string,
		{
			card_name: string
			total_copies: number
			order_ids: Set<string>
			card_ids: Set<string>   // ALL card_ids seen; may include mismatched ones
		}
	>()

	for (const item of rawItems) {
		const key = item.card_name
		const existing = aggregateMap.get(key)
		if (existing) {
			existing.total_copies += item.quantity ?? 1
			existing.order_ids.add(item.order_id)
			if (item.card_id) existing.card_ids.add(item.card_id)
		} else {
			aggregateMap.set(key, {
				card_name: item.card_name,
				total_copies: item.quantity ?? 1,
				order_ids: new Set([item.order_id]),
				card_ids: new Set(item.card_id ? [item.card_id] : [])
			})
		}
	}

	// Sort by total_copies desc, take top 200
	const ranked = [...aggregateMap.values()]
		.map((e) => ({
			card_name: e.card_name,
			total_copies: e.total_copies,
			distinct_orders: e.order_ids.size,
			card_ids: [...e.card_ids]   // all candidate IDs for this card name
		}))
		.sort((a, b) => b.total_copies - a.total_copies)
		.slice(0, 200)

	// --- Fetch card display data for all candidate card_ids ---
	// We collect every card_id referenced by the top 200 entries (can be >200
	// if some names had multiple card_ids across orders). The merge step will
	// pick the best-matching card_id for each name.
	const cardIds = [...new Set(ranked.flatMap((r) => r.card_ids))]

	type CardRow = {
		id: string
		card_name: string
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
			.select('id, card_name, scryfall_id, card_type, foil_type, set_name, set_code, collector_number, mana_cost, type_line, is_in_stock')
			.in('id', cardIds)

		if (cardsError) {
			logger.error({ error: cardsError }, 'Failed to fetch card details for popular page')
		} else {
			cardMap = new Map((cardDetails ?? []).map((c) => [c.id, c as CardRow]))
		}
	}

	// --- Merge card details into ranked list ---
	// For each aggregated card_name, pick the card_id whose linked card row has a
	// matching name. This handles order_items rows where card_name and card_id
	// disagree (e.g., orders placed for "The Mind Stone" that somehow got linked
	// to Stasis's card_id due to a data-entry error).
	const popularCards: PopularCard[] = ranked.map((r, i) => {
		// Find the best-matching card among all candidate IDs for this name
		let bestCard: (typeof cardMap extends Map<string, infer V> ? V : never) | undefined
		let bestCardId: string | null = null

		for (const cid of r.card_ids) {
			const candidate = cardMap.get(cid)
			if (candidate && candidate.card_name.toLowerCase() === r.card_name.toLowerCase()) {
				bestCard = candidate
				bestCardId = cid
				break   // first name-matching card wins
			}
		}

		// Fallback: if no name-matching card found, use the first available
		// (scryfall_id will be nulled below since namesMatch = false)
		if (!bestCard && r.card_ids.length > 0) {
			bestCardId = r.card_ids[0]!
			bestCard = cardMap.get(bestCardId)
		}

		const namesMatch = bestCard?.card_name?.toLowerCase() === r.card_name.toLowerCase()

		return {
			rank: i + 1,
			card_name: r.card_name,
			total_copies: r.total_copies,
			distinct_orders: r.distinct_orders,
			card_id: namesMatch ? bestCardId : null,
			scryfall_id: (namesMatch ? bestCard?.scryfall_id : null) ?? null,
			card_type: (namesMatch ? bestCard?.card_type : null) ?? null,
			foil_type: (namesMatch ? bestCard?.foil_type : null) ?? null,
			set_name: (namesMatch ? bestCard?.set_name : null) ?? null,
			set_code: (namesMatch ? bestCard?.set_code : null) ?? null,
			collector_number: (namesMatch ? bestCard?.collector_number : null) ?? null,
			mana_cost: (namesMatch ? bestCard?.mana_cost : null) ?? null,
			type_line: (namesMatch ? bestCard?.type_line : null) ?? null,
			is_in_stock: (namesMatch ? bestCard?.is_in_stock : null) ?? false
		}
	})


	// --- Fetch Scryfall symbol map (cached) ---
	const symbolMap = await fetchSymbolMap()

	return {
		popularCards,
		groupBuys: groupBuys ?? [],
		groupBuyFilter,
		symbolMap
	}
}
