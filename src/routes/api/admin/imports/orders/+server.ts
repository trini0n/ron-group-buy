import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireAdmin, createAdminClient } from '$lib/server/admin'
import { listSheetNames, parseOrderSheet } from '$lib/server/import-parser'
import { logger } from '$lib/server/logger'
import { getCardPrice } from '$lib/utils'
import { FALLBACK_PRICES } from '$lib/server/pricing'

export const POST: RequestHandler = async ({ request, locals }) => {
  await requireAdmin(locals)

  const contentType = request.headers.get('content-type') || ''
  const adminClient = createAdminClient()

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const action = formData.get('action')
    
    if (action === 'list-sheets') {
      const file = formData.get('file') as File
      if (!file) throw error(400, 'No file uploaded')
      
      const buffer = Buffer.from(await file.arrayBuffer())
      const sheets = await listSheetNames(buffer)
      
      return json({ sheets })
    }
    
    if (action === 'parse-sheet') {
      const file = formData.get('file') as File
      const sheetName = formData.get('sheetName') as string
      if (!file || !sheetName) throw error(400, 'Missing file or sheetName')
      
      const buffer = Buffer.from(await file.arrayBuffer())
      const parsed = await parseOrderSheet(buffer, sheetName)
      
      let matchedUserId: string | null = null
      let matchedUserEmail: string | null = null
      
      if (parsed.header.paypalEmail) {
        const { data: users } = await adminClient
          .from('users')
          .select('id, email')
          .or(`paypal_email.eq.${parsed.header.paypalEmail},email.eq.${parsed.header.paypalEmail}`)
          .limit(1)
        
        if (users && users.length > 0) {
          matchedUserId = users[0]!.id
          matchedUserEmail = users[0]!.email
        }
      }
      
      const matchResults = []
      
      for (const item of parsed.items) {
        if (item.isBundle) {
          const { data: sets } = await adminClient
            .from('sets')
            .select('set_code, set_name, price')
            .eq('set_code', item.cardSerial.toLowerCase())
            .limit(1)
            
          matchResults.push({
            item,
            matched: sets && sets.length > 0,
            setData: sets?.[0] || null
          })
        } else {
          // Match by serial — the card serial is unique and the most reliable identifier
          const { data: cards } = await adminClient
            .from('cards')
            .select('id, serial, card_name, card_type, set_code, collector_number, is_foil, is_etched, language')
            .eq('serial', item.cardSerial)
            .limit(1)
          
          matchResults.push({
            item,
            matched: cards && cards.length > 0,
            cardData: cards?.[0] || null
          })
        }
      }
      
      return json({
        parsed,
        matchedUserId,
        matchedUserEmail,
        matchResults
      })
    }
  } else if (contentType.includes('application/json')) {
    // import action
    const body = await request.json()
    const { action, groupBuyId, userId, parsed, matchResults } = body
    
    if (action === 'import') {
      if (!groupBuyId || !userId) throw error(400, 'Missing groupBuyId or userId')
      
      // Generate order number
      const timestamp36 = Date.now().toString(36).toUpperCase()
      const random = Math.random().toString(36).substring(2, 6).toUpperCase()
      const orderNumber = `ORD-${timestamp36}-${random}`
      
      // Insert order
      const { data: order, error: orderError } = await adminClient
        .from('orders')
        .insert({
          group_buy_id: groupBuyId,
          user_id: userId,
          order_number: orderNumber,
          status: parsed.header.orderStatus?.toLowerCase() || 'pending',
          shipping_name: parsed.header.shippingName || '',
          shipping_line1: parsed.header.shippingLine1 || '',
          shipping_line2: parsed.header.shippingLine2 || null,
          shipping_city: parsed.header.shippingCity || '',
          shipping_state: parsed.header.shippingState || null,
          shipping_postal_code: parsed.header.shippingPostalCode || '',
          shipping_country: parsed.header.shippingCountry || '',
          shipping_phone_number: parsed.header.shippingPhoneNumber || null,
          shipping_type: parsed.header.shippingType || 'regular',
          notes: parsed.header.customerNotes || null,
          admin_notes: parsed.header.adminNotes || null,
          created_at: parsed.header.orderDate ? new Date(parsed.header.orderDate).toISOString() : new Date().toISOString()
        })
        .select('id')
        .single()
        
      if (orderError || !order) {
        logger.error({ error: orderError }, 'Failed to insert order')
        throw error(500, 'Failed to insert order')
      }
      
      const orderId = order.id
      
      const itemsToInsert = []
      const bundlesToInsert = []
      
      for (const mr of matchResults) {
        const item = mr.item
        if (item.isBundle) {
          bundlesToInsert.push({
            order_id: orderId,
            set_code: mr.setData?.set_code || item.cardSerial.toLowerCase(),
            set_name: mr.setData?.set_name || item.cardName,
            quantity: item.quantity,
            price_at_purchase: mr.setData?.price != null ? Number(mr.setData.price) : 0
          })
        } else {
          // Determine card_type for pricing:
          // If matched to inventory, use the card's actual card_type
          // Otherwise, derive from the Finish column in the export
          const cardType = mr.cardData?.card_type || item.finish || 'Normal'
          const unitPrice = getCardPrice(cardType, FALLBACK_PRICES)

          itemsToInsert.push({
            order_id: orderId,
            card_id: mr.cardData?.id || null,
            card_serial: item.cardSerial,
            card_name: item.cardName,
            card_type: cardType,
            quantity: item.quantity,
            unit_price: unitPrice,
            set_code: item.setCode?.toLowerCase() || null,
            collector_number: item.collectorNumber || null,
            is_foil: item.finish.toLowerCase().includes('foil') || item.finish === 'Raised Foil',
            is_etched: item.finish === 'Etched' || item.finish === 'Foil Etched',
            language: item.language || 'en'
          })
        }
      }
      
      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await adminClient.from('order_items').insert(itemsToInsert)
        if (itemsError) logger.error({ error: itemsError }, 'Failed to insert order items')
      }
      
      if (bundlesToInsert.length > 0) {
        const { error: bundlesError } = await adminClient.from('order_bundle_items').insert(bundlesToInsert)
        if (bundlesError) logger.error({ error: bundlesError }, 'Failed to insert order bundle items')
      }
      
      return json({ success: true, orderId })
    }
  }
  
  throw error(400, 'Invalid request')
}
