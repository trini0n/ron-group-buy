import ExcelJS from 'exceljs'
import { createAdminClient } from './admin'
import { getFrameEffectLabel, getFinishLabel, sortOrdersByShippingAndDate, compareSerials } from '$lib/utils'

// Type definitions for export data structures
// Using explicit types instead of Database types to avoid import issues
interface Order {
  id: string
  user_id: string
  order_number: string
  status: string
  created_at: string
  notes: string | null
  admin_notes: string | null
  shipping_name: string
  shipping_line1: string
  shipping_line2: string | null
  shipping_city: string
  shipping_state: string | null
  shipping_postal_code: string
  shipping_country: string
  shipping_type: string
  shipping_phone_number?: string | null
}

interface OrderItem {
  id: string
  order_id: string
  card_id: string | null
  card_serial: string
  card_name: string
  card_type: string
  quantity: number
  unit_price: number
}

interface Card {
  set_code: string
  collector_number: string
  is_retro: boolean | null
  is_extended: boolean | null
  is_showcase: boolean | null
  is_borderless: boolean | null
  is_etched: boolean | null
  foil_type: string | null
  card_type: string
  language: string | null
  flavor_name: string | null
}

interface OrderBundleItem {
  id: string
  set_code: string
  set_name: string
  quantity: number
  price_at_purchase: number
}

interface OrderExportData extends Order {
  user: {
    email: string
    paypal_email: string | null
  } | null
  items: OrderItemExportData[]
  bundle_items: OrderBundleItem[]
}

interface OrderItemExportData extends OrderItem {
  card: Card | null
  // Snapshot fields for when card is deleted
  set_code?: string | null
  collector_number?: string | null
  is_foil?: boolean | null
  is_etched?: boolean | null
  language?: string | null
}

// Constants for pricing
const SHIPPING_RATES = {
  us: { regular: 6.0, express: 40.0, tariff: 9.0 },
  international: { regular: 6.0, express: 25.0, tariff: 0 }
}

/**
 * Export a single order as an Excel workbook
 */
export async function exportSingleOrder(orderId: string): Promise<Buffer> {
  const order = await fetchOrderData(orderId)

  const workbook = new ExcelJS.Workbook()
  await buildOrderWorksheet(workbook, order)

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}

/**
 * Export all orders for a group buy as an Excel workbook with multiple tabs
 */
export async function exportGroupBuyOrders(groupBuyId: string): Promise<Buffer> {
  const orders = await fetchGroupBuyOrders(groupBuyId)

  const workbook = new ExcelJS.Workbook()

  // Build a worksheet for each order
  for (const order of orders) {
    await buildOrderWorksheet(workbook, order)
  }

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}

/**
 * Fetch complete order data with all relations for export
 */
async function fetchOrderData(orderId: string): Promise<OrderExportData> {
  const adminClient = createAdminClient()

  const { data: order, error } = await adminClient
    .from('orders')
    .select(
      `
      *,
      user:users!orders_user_id_fkey(email, paypal_email),
      items:order_items(
        *,
        card:cards(
          set_code,
          collector_number,
          is_retro,
          is_extended,
          is_showcase,
          is_borderless,
          is_etched,
          foil_type,
          card_type,
          language,
          flavor_name
        )
      ),
      bundle_items:order_bundle_items(
        id,
        set_code,
        set_name,
        quantity,
        price_at_purchase
      )
    `
    )
    .eq('id', orderId)
    .single()

  if (error || !order) {
    throw new Error(`Order not found: ${orderId}`)
  }

  return order as unknown as OrderExportData
}

/**
 * Fetch all orders for a group buy, sorted by shipping type then creation date
 */
async function fetchGroupBuyOrders(groupBuyId: string): Promise<OrderExportData[]> {
  const adminClient = createAdminClient()

  const { data: orders, error } = await adminClient
    .from('orders')
    .select(
      `
      *,
      user:users!orders_user_id_fkey(email, paypal_email),
      items:order_items(
        *,
        card:cards(
          set_code,
          collector_number,
          is_retro,
          is_extended,
          is_showcase,
          is_borderless,
          is_etched,
          foil_type,
          card_type,
          language,
          flavor_name
        )
      ),
      bundle_items:order_bundle_items(
        id,
        set_code,
        set_name,
        quantity,
        price_at_purchase
      )
    `
    )
    .eq('group_buy_id', groupBuyId)

  if (error) {
    throw new Error(`Failed to fetch orders for group buy: ${groupBuyId}`)
  }

  const typedOrders = (orders || []) as unknown as OrderExportData[]

  // Sort orders by shipping type (express first) then by created_at
  return sortOrdersByShippingAndDate(typedOrders)
}

/**
 * Build a single worksheet for an order
 */
async function buildOrderWorksheet(workbook: ExcelJS.Workbook, order: OrderExportData): Promise<void> {
  // Create worksheet with order number as tab name
  const worksheet = workbook.addWorksheet(order.order_number || 'Order')

  // Set column widths
  worksheet.columns = [
    { width: 15 }, // A - Card Serial
    { width: 30 }, // B - Card Name
    { width: 20 }, // C - Flavor Name
    { width: 25 }, // D - Card Frame
    { width: 12 }, // E - Finish
    { width: 10 }, // F - Set Code
    { width: 10 }, // G - Collector Number
    { width: 10 }, // H - Language
    { width: 8 } // I - Quantity
  ]

  let currentRow = 1

  // === HEADER SECTION ===

  // Order Number
  worksheet.getCell(`A${currentRow}`).value = 'Order Number:'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  worksheet.getCell(`B${currentRow}`).value = order.order_number
  currentRow++

  // Order Date
  worksheet.getCell(`A${currentRow}`).value = 'Order Date:'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  worksheet.getCell(`B${currentRow}`).value = formatDate(order.created_at)
  currentRow++

  // Order Status
  worksheet.getCell(`A${currentRow}`).value = 'Order Status:'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  worksheet.getCell(`B${currentRow}`).value = formatStatus(order.status)
  currentRow++

  // Blank row
  currentRow++

  // Shipping Information header
  worksheet.getCell(`A${currentRow}`).value = 'Shipping Information:'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  currentRow++

  // Shipping name
  worksheet.getCell(`B${currentRow}`).value = order.shipping_name
  currentRow++

  // Address line 1
  worksheet.getCell(`B${currentRow}`).value = order.shipping_line1
  currentRow++

  // Address line 2 (if present)
  if (order.shipping_line2) {
    worksheet.getCell(`B${currentRow}`).value = order.shipping_line2
    currentRow++
  }

  // City, State ZIP
  worksheet.getCell(`B${currentRow}`).value =
    `${order.shipping_city}, ${order.shipping_state || ''} ${order.shipping_postal_code}`.trim()
  currentRow++

  // Country
  worksheet.getCell(`B${currentRow}`).value = order.shipping_country
  currentRow++

  // Phone Number
  if (order.shipping_phone_number) {
    worksheet.getCell(`A${currentRow}`).value = 'Phone Number:'
    worksheet.getCell(`A${currentRow}`).font = { bold: true }
    worksheet.getCell(`B${currentRow}`).value = order.shipping_phone_number
    currentRow++
  }

  // Shipping speed
  const shippingSpeed = order.shipping_type === 'express' ? 'Express' : 'Regular'
  worksheet.getCell(`B${currentRow}`).value = `Shipping Speed: ${shippingSpeed}`
  currentRow++

  // Blank row
  currentRow++

  // PayPal Email
  worksheet.getCell(`A${currentRow}`).value = 'PayPal Email:'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  const paypalEmail = order.user?.paypal_email || order.user?.email || ''
  worksheet.getCell(`B${currentRow}`).value = paypalEmail
  currentRow++

  // Blank row
  currentRow++

  // Customer Notes (if present)
  if (order.notes) {
    worksheet.getCell(`A${currentRow}`).value = 'Customer Notes:'
    worksheet.getCell(`A${currentRow}`).font = { bold: true }
    currentRow++

    // Notes can be multi-line, so split and add each line
    const noteLines = order.notes.split('\n')
    for (const line of noteLines) {
      worksheet.getCell(`B${currentRow}`).value = line
      currentRow++
    }

    // Blank row after notes
    currentRow++
  }

  // Admin Notes (if present)
  if (order.admin_notes) {
    worksheet.getCell(`A${currentRow}`).value = 'Admin Notes:'
    worksheet.getCell(`A${currentRow}`).font = { bold: true }
    currentRow++

    // Admin notes can be multi-line, so split and add each line
    const adminNoteLines = order.admin_notes.split('\n')
    for (const line of adminNoteLines) {
      worksheet.getCell(`B${currentRow}`).value = line
      currentRow++
    }

    // Blank row after admin notes
    currentRow++
  }

  // Order Summary
  worksheet.getCell(`A${currentRow}`).value = 'Order Summary:'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  currentRow++

  // Calculate totals
  const totals = calculateOrderTotals(order)

  // Subtotal
  worksheet.getCell(`B${currentRow}`).value = 'Subtotal:'
  worksheet.getCell(`C${currentRow}`).value = formatCurrency(totals.subtotal)
  currentRow++

  // Shipping
  worksheet.getCell(`B${currentRow}`).value = `Shipping:`
  worksheet.getCell(`C${currentRow}`).value = `${formatCurrency(totals.shipping)} (${shippingSpeed})`
  currentRow++

  // Tariff (if US)
  if (totals.tariff > 0) {
    worksheet.getCell(`B${currentRow}`).value = 'Tariff:'
    worksheet.getCell(`C${currentRow}`).value = formatCurrency(totals.tariff)
    currentRow++
  }

  // Grand Total
  worksheet.getCell(`B${currentRow}`).value = 'Grand Total:'
  worksheet.getCell(`B${currentRow}`).font = { bold: true }
  worksheet.getCell(`C${currentRow}`).value = formatCurrency(totals.total)
  worksheet.getCell(`C${currentRow}`).font = { bold: true }
  currentRow++

  // Blank row before table
  currentRow++

  // === LINE ITEMS TABLE ===

  const tableHeaderRow = currentRow

  // Table headers
  const headers = [
    'Card Serial',
    'Card Name',
    'Flavor Name',
    'Card Frame',
    'Finish',
    'Set Code',
    'Collector Number',
    'Language',
    'Quantity'
  ]

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(tableHeaderRow, index + 1)
    cell.value = header
    cell.font = { bold: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  })

  currentRow++

  // Line items data - sort by serial number (Normal < Holo < Foil, ascending numeric)
  const sortedItems = [...(order.items || [])].sort((a, b) => compareSerials(a.card_serial, b.card_serial))

  // Bundle rows first (Set Bundles appear before individual cards)
  for (const bundle of (order.bundle_items || [])) {
    const bundleRow = [
      bundle.set_code.toUpperCase(),     // Card Serial  ← set code
      `${bundle.set_name} (Set Bundle)`, // Card Name
      '—',                               // Flavor Name
      '—',                               // Card Frame
      'Set',                             // Finish
      '—',                               // Set Code
      '—',                               // Collector Number
      '',                                // Language
      bundle.quantity || 1               // Quantity
    ]
    bundleRow.forEach((value, index) => {
      const cell = worksheet.getCell(currentRow, index + 1)
      cell.value = value
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })
    currentRow++
  }

  for (const item of sortedItems) {
    const rowData = buildLineItemRow(item)

    rowData.forEach((value, index) => {
      const cell = worksheet.getCell(currentRow, index + 1)
      cell.value = value
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })

    currentRow++
  }
}

/**
 * Build a single line item row for the export table
 */
function buildLineItemRow(item: OrderItemExportData): (string | number)[] {
  // Use fresh metadata from card if available, otherwise use snapshots
  const setCode = item.card?.set_code || item.set_code || ''
  const collectorNumber = item.card?.collector_number || item.collector_number || ''

  // Calculate frame effect
  const frameLabel = item.card ? getFrameEffectLabel(item.card) || 'Regular' : 'Regular'

  // Calculate finish
  // For deleted cards (no live card data), derive from serial suffix before falling back
  // to the snapshot: suffix 'r' = Raised Foil, suffix 'z' = Serialized (migration convention)
  const finishLabel = item.card
    ? getFinishLabel(item.card)
    : item.card_serial.endsWith('r')
      ? 'Raised Foil'
      : item.card_serial.endsWith('z')
        ? 'Serialized'
        : item.card_type

  // Language (only show if not English)
  const language = item.card?.language || item.language || 'en'
  const languageDisplay = language === 'en' ? '' : language

  // Flavor name
  const flavorName = item.card?.flavor_name || ''

  return [
    item.card_serial,
    item.card_name,
    flavorName,
    frameLabel,
    finishLabel,
    setCode.toUpperCase(),
    collectorNumber,
    languageDisplay,
    item.quantity || 1
  ]
}

/**
 * Calculate order totals (subtotal, shipping, tariff, grand total)
 */
function calculateOrderTotals(order: OrderExportData) {
  const cardSubtotal = (order.items || []).reduce((sum, item) => {
    return sum + (item.quantity || 0) * Number(item.unit_price || 0)
  }, 0)

  const bundleSubtotal = (order.bundle_items || []).reduce((sum, b) => {
    return sum + (b.quantity || 1) * Number(b.price_at_purchase || 0)
  }, 0)

  const subtotal = cardSubtotal + bundleSubtotal

  // Determine if US shipping
  const country = order.shipping_country?.toUpperCase() || ''
  const isUS = country === 'US' || country === 'USA' || country === 'UNITED STATES'

  const rates = isUS ? SHIPPING_RATES.us : SHIPPING_RATES.international
  const shipping = order.shipping_type === 'express' ? rates.express : rates.regular
  const tariff = rates.tariff
  const total = subtotal + shipping + tariff

  return { subtotal, shipping, tariff, total }
}

/**
 * Format date for display
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return '—'

  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format order status for display
 */
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    invoiced: 'Invoiced',
    paid: 'Paid',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  }

  return statusMap[status] || status
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

// ─── Sets Export ──────────────────────────────────────────────────────────────

/** Escape a value for CSV (wrap in quotes if it contains comma, quote, or newline) */
function csvCell(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(...cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(',')
}

/**
 * Export all sets as a single CSV.
 * Each set gets a metadata header block then its cards (or plaintext list as fallback).
 * Sets are separated by a blank line.
 */
export async function exportAllSets(): Promise<Buffer> {
  const adminClient = createAdminClient()

  // Fetch sets with card_list_text for the plaintext fallback
  const { data: sets, error: setsError } = await adminClient
    .from('sets')
    .select('set_code, set_name, set_type, price, card_list_text')
    .order('sort_order', { ascending: true })
    .order('set_name', { ascending: true })

  if (setsError) throw new Error('Failed to fetch sets')

  // ── Step 1: fetch set_cards WITHOUT a join to avoid PostgREST shadowing set_cards.set_code
  //   with the identically-named cards.set_code column (was silently dropping Holo/Normal sets).
  // Supabase JS default cap is 1000 rows — override with an explicit limit.
  const { data: setCards, error: setCardsError } = await adminClient
    .from('set_cards')
    .select('set_code, card_id, quantity')
    .limit(50000)
    .order('created_at', { ascending: true })

  if (setCardsError) throw new Error('Failed to fetch set cards')

  // ── Step 2: fetch card metadata in one batch using the collected card IDs
  const cardIds = [
    ...new Set(
      (setCards ?? []).map((sc) => sc.card_id).filter((id): id is string => Boolean(id))
    )
  ]

  const cardsById = new Map<string, {
    set_code: string | null
    collector_number: string | null
    language: string | null
    card_type: string
    serial: string | null
    card_name: string
  }>()

  if (cardIds.length > 0) {
    // Chunk into batches of 500 — .in() encodes IDs in the URL and hits length limits
    // with large catalogs, which causes a silent empty-response or fetch error.
    const CHUNK = 500
    for (let i = 0; i < cardIds.length; i += CHUNK) {
      const chunk = cardIds.slice(i, i + CHUNK)
      const { data: cardsData, error: cardsFetchError } = await adminClient
        .from('cards')
        .select('id, set_code, collector_number, language, card_type, serial, card_name')
        .in('id', chunk)

      if (cardsFetchError) {
        throw new Error(`Failed to fetch card metadata (chunk ${Math.floor(i / CHUNK) + 1}): ${cardsFetchError.message}`)
      }

      for (const c of cardsData ?? []) {
        cardsById.set(c.id, {
          set_code: (c.set_code as string | null) ?? null,
          collector_number: (c.collector_number as string | null) ?? null,
          language: (c.language as string | null) ?? null,
          card_type: (c.card_type as string) ?? '',
          serial: (c.serial as string | null) ?? null,
          card_name: (c.card_name as string) ?? ''
        })
      }
    }
  }

  // ── Step 3: group by bundle set_code (set_cards.set_code)
  const cardsBySet = new Map<string, Array<{
    set_code: string | null
    collector_number: string | null
    language: string | null
    card_type: string
    serial: string | null
    card_name: string
    quantity: number
  }>>()

  for (const sc of setCards ?? []) {
    const bundleCode = sc.set_code as string | null
    if (!bundleCode || !sc.card_id) continue
    const card = cardsById.get(sc.card_id as string) ?? null
    if (!cardsBySet.has(bundleCode)) cardsBySet.set(bundleCode, [])
    cardsBySet.get(bundleCode)!.push({
      set_code: card?.set_code ?? null,
      collector_number: card?.collector_number ?? null,
      language: card?.language ?? null,
      card_type: card?.card_type ?? '',
      serial: card?.serial ?? null,
      card_name: card?.card_name ?? '',
      quantity: (sc.quantity as number) ?? 1
    })
  }

  const lines: string[] = []

  for (const set of sets ?? []) {
    // ── Set metadata header ──
    lines.push(csvRow('Set Code', set.set_code ?? ''))
    lines.push(csvRow('Name', set.set_name ?? ''))
    lines.push(csvRow('Type', (set.set_type as string) ?? 'Normal'))
    lines.push(csvRow('Price', set.price != null ? formatCurrency(Number(set.price)) : ''))
    lines.push('')

    const importedCards = cardsBySet.get(set.set_code) ?? []

    if (importedCards.length > 0) {
      // ── Structured card rows ──
      lines.push(csvRow('Set', 'Coll#', 'Lang', 'Card Name', 'Type', 'Serial', 'Qty'))
      for (const card of importedCards) {
        lines.push(csvRow(
          (card.set_code ?? '').toUpperCase(),
          card.collector_number ?? '',
          card.language && card.language !== 'en' ? card.language : '',
          card.card_name,
          card.card_type ?? '',
          card.serial ?? '',
          card.quantity
        ))
      }
    } else if (set.card_list_text?.trim()) {
      // ── Plaintext list fallback ──
      lines.push(csvRow('Card List'))
      for (const cardLine of set.card_list_text.split('\n')) {
        const trimmed = cardLine.trim()
        if (trimmed) lines.push(csvCell(trimmed))
      }
    }

    // Blank separator between sets
    lines.push('')
  }

  return Buffer.from(lines.join('\r\n'), 'utf-8')
}
