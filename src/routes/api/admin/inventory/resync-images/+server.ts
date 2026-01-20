import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdminDiscordId } from '$lib/server/admin'
import { parse } from 'csv-parse/sync'
import { getDirectPhotoUrl } from '$lib/server/gphoto-converter'

// Published CSV URL for the Library sheet
const LIBRARY_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSMUbO_Hsty-uIqFPWL2RdYyZ4nWPCHoW9n1YApAdZeg9A8JUGfME_dPyNSWpSamE6_DOAMYQOevvlK/pub?gid=1297811197&single=true&output=csv'

interface CsvRow {
  Serial: string
  'Ron Print': string
}

// Helper to verify admin access
async function verifyAdmin(locals: App.Locals) {
  const user = locals.user
  if (!user) {
    throw error(401, 'Not authenticated')
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', user.id).single()

  if (!isAdminDiscordId(userData?.discord_id)) {
    throw error(403, 'Not authorized')
  }

  return { user, adminClient }
}

/**
 * Resync card images for specific cards
 * POST body: { card_ids: string[] }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const { adminClient } = await verifyAdmin(locals)

  const body = await request.json()
  const { card_ids } = body

  // Validate input
  if (!Array.isArray(card_ids) || card_ids.length === 0) {
    throw error(400, 'card_ids must be a non-empty array')
  }

  // Limit batch size to prevent abuse
  if (card_ids.length > 50) {
    throw error(400, 'Maximum 50 cards can be resynced at once')
  }

  try {
    // Fetch the cards to get their serials
    const { data: cards, error: fetchError } = await adminClient
      .from('cards')
      .select('id, serial, ron_image_url')
      .in('id', card_ids)

    if (fetchError) {
      console.error('Error fetching cards:', fetchError)
      throw error(500, 'Failed to fetch cards')
    }

    if (!cards || cards.length === 0) {
      throw error(404, 'No cards found')
    }

    const serialToIdMap = new Map(cards.map((c) => [c.serial, c.id]))
    const serialsToUpdate = cards.map((c) => c.serial)

    console.log(`📷 Resyncing images for ${serialsToUpdate.length} cards: ${serialsToUpdate.join(', ')}`)

    // Fetch CSV from Google Sheets
    const response = await fetch(LIBRARY_CSV_URL)
    if (!response.ok) {
      throw new Error(`Failed to fetch Library: ${response.status} ${response.statusText}`)
    }

    const csvContent = await response.text()
    const records: CsvRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    })

    // Find the matching rows from the sheet
    const sheetDataMap = new Map<string, string>()
    for (const row of records) {
      if (row.Serial && serialsToUpdate.includes(row.Serial)) {
        sheetDataMap.set(row.Serial, row['Ron Print'] || '')
      }
    }

    console.log(`📊 Found ${sheetDataMap.size} matching cards in sheet`)

    // Convert URLs and update cards sequentially (better for rate limiting)
    let successCount = 0
    let errorCount = 0

    for (const serial of serialsToUpdate) {
      const cardId = serialToIdMap.get(serial)
      const ronPrintUrl = sheetDataMap.get(serial)

      if (!cardId) {
        console.warn(`Card ID not found for serial: ${serial}`)
        errorCount++
        continue
      }

      if (!ronPrintUrl) {
        console.warn(`No Ron Print URL found in sheet for serial: ${serial}`)
        // Set to null to clear the image
        const { error: updateError } = await adminClient
          .from('cards')
          .update({ ron_image_url: null })
          .eq('id', cardId)

        if (updateError) {
          console.error(`Failed to clear image for ${serial}:`, updateError)
          errorCount++
        } else {
          console.log(`🗑️ Cleared image for ${serial} (no URL in sheet)`)
          successCount++
        }
        continue
      }

      try {
        // Convert the URL with caching support (reduces external fetches)
        const directUrl = await getDirectPhotoUrl(ronPrintUrl, adminClient)

        if (directUrl) {
          const { error: updateError } = await adminClient
            .from('cards')
            .update({ ron_image_url: directUrl })
            .eq('id', cardId)

          if (updateError) {
            console.error(`Failed to update ${serial}:`, updateError)
            errorCount++
          } else {
            console.log(`✅ Updated ${serial}: ${directUrl.substring(0, 50)}...`)
            successCount++
          }
        } else {
          // If conversion failed, store the original URL
          const { error: updateError } = await adminClient
            .from('cards')
            .update({ ron_image_url: ronPrintUrl })
            .eq('id', cardId)

          if (updateError) {
            console.error(`Failed to update ${serial}:`, updateError)
            errorCount++
          } else {
            console.log(`⚠️ Stored original URL for ${serial} (conversion failed)`)
            successCount++
          }
        }

        // Small delay between conversions to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (err) {
        console.error(`Error processing ${serial}:`, err)
        errorCount++
      }
    }

    console.log(`🎉 Resync complete! Success: ${successCount}, Errors: ${errorCount}`)

    return json({
      success: true,
      updated: successCount,
      errors: errorCount,
      total: card_ids.length
    })
  } catch (err) {
    console.error('❌ Resync failed:', err)
    if (err instanceof Error && 'status' in err) {
      throw err
    }
    throw error(500, err instanceof Error ? err.message : 'Failed to resync images')
  }
}
