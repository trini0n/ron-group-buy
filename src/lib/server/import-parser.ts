import ExcelJS from 'exceljs'

export interface ParsedOrderHeader {
  orderNumber: string | null
  orderDate: string | null
  orderStatus: string | null
  shippingName: string | null
  shippingLine1: string | null
  shippingLine2: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingPostalCode: string | null
  shippingCountry: string | null
  shippingPhoneNumber: string | null
  shippingType: 'regular' | 'express'
  paypalEmail: string | null
  customerNotes: string | null
  adminNotes: string | null
}

export interface ParsedLineItem {
  cardSerial: string
  cardName: string
  flavorName: string
  cardFrame: string
  finish: string
  setCode: string
  collectorNumber: string
  language: string
  quantity: number
  isBundle: boolean
}

export interface ParsedOrderImport {
  header: ParsedOrderHeader
  items: ParsedLineItem[]
}

// List all sheet names from a workbook buffer
export async function listSheetNames(buffer: Buffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  return workbook.worksheets.map(sheet => sheet.name)
}

// Parse a single sheet by name
export async function parseOrderSheet(buffer: Buffer, sheetName: string): Promise<ParsedOrderImport> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  const sheet = workbook.getWorksheet(sheetName)
  
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`)
  }

  const header: ParsedOrderHeader = {
    orderNumber: null,
    orderDate: null,
    orderStatus: null,
    shippingName: null,
    shippingLine1: null,
    shippingLine2: null,
    shippingCity: null,
    shippingState: null,
    shippingPostalCode: null,
    shippingCountry: null,
    shippingPhoneNumber: null,
    shippingType: 'regular',
    paypalEmail: null,
    customerNotes: null,
    adminNotes: null
  }

  const items: ParsedLineItem[] = []

  let inCustomerNotes = false
  let inAdminNotes = false
  let customerNotes: string[] = []
  let adminNotes: string[] = []

  // Iterate rows to extract header details
  let shippingInfoRow = -1
  let tableStartRow = -1
  
  sheet.eachRow((row, rowNumber) => {
    const cellA = row.getCell(1).text?.trim()
    const cellB = row.getCell(2).text?.trim()

    if (cellA === 'Order Number:') header.orderNumber = cellB
    if (cellA === 'Order Date:') header.orderDate = cellB
    if (cellA === 'Order Status:') header.orderStatus = cellB
    if (cellA === 'Phone Number:') header.shippingPhoneNumber = cellB
    if (cellA === 'PayPal Email:') header.paypalEmail = cellB
    
    if (cellA === 'Customer Notes:') {
      inCustomerNotes = true
      inAdminNotes = false
    } else if (cellA === 'Admin Notes:') {
      inCustomerNotes = false
      inAdminNotes = true
    } else if (cellA === 'Order Summary:') {
      inCustomerNotes = false
      inAdminNotes = false
    } else if (cellA === 'Shipping Information:') {
      shippingInfoRow = rowNumber
    } else if (cellA === 'Quantity' && row.getCell(2).text?.trim() === 'Card Serial') {
      tableStartRow = rowNumber
    } else {
      if (inCustomerNotes && cellB) customerNotes.push(cellB)
      if (inAdminNotes && cellB) adminNotes.push(cellB)
    }

    if (cellB?.startsWith('Shipping Speed:')) {
      header.shippingType = cellB.toLowerCase().includes('express') ? 'express' : 'regular'
    }
  })

  if (customerNotes.length > 0) header.customerNotes = customerNotes.join('\n')
  if (adminNotes.length > 0) header.adminNotes = adminNotes.join('\n')

  if (shippingInfoRow > 0) {
    // Shipping rows:
    // +1: Name
    // +2: Line 1
    // +3: Line 2 OR City, State Zip
    // +4: City, State Zip OR Country
    // +5: Country OR (Phone Number / Shipping Speed)
    
    const sName = sheet.getRow(shippingInfoRow + 1).getCell(2).text?.trim()
    const sLine1 = sheet.getRow(shippingInfoRow + 2).getCell(2).text?.trim()
    
    header.shippingName = sName || null
    header.shippingLine1 = sLine1 || null
    
    let currentRow = shippingInfoRow + 3
    let nextVal = sheet.getRow(currentRow).getCell(2).text?.trim()
    
    const values: string[] = []
    while (nextVal && !nextVal.startsWith('Shipping Speed:') && !sheet.getRow(currentRow).getCell(1).text?.trim()) {
      values.push(nextVal)
      currentRow++
      nextVal = sheet.getRow(currentRow).getCell(2).text?.trim()
    }
    
    // values can be:
    // [Line2, CityStateZip, Country]
    // [CityStateZip, Country]
    if (values.length >= 2) {
      header.shippingCountry = values.pop() || null
      const cityStateZip = values.pop() || null
      
      if (values.length > 0) {
        header.shippingLine2 = values[0] || null
      }
      
      if (cityStateZip) {
        // Parse City, State ZIP
        // Usually: "City, State 12345" or "City, 12345"
        const lastCommaIdx = cityStateZip.lastIndexOf(',')
        if (lastCommaIdx !== -1) {
          header.shippingCity = cityStateZip.substring(0, lastCommaIdx).trim()
          const stateZip = cityStateZip.substring(lastCommaIdx + 1).trim()
          const lastSpaceIdx = stateZip.lastIndexOf(' ')
          if (lastSpaceIdx !== -1) {
            header.shippingState = stateZip.substring(0, lastSpaceIdx).trim()
            header.shippingPostalCode = stateZip.substring(lastSpaceIdx + 1).trim()
          } else {
            // maybe no state, just zip?
            header.shippingPostalCode = stateZip
          }
        } else {
          // no comma? just set city
          header.shippingCity = cityStateZip
        }
      }
    }
  }

  if (tableStartRow > 0) {
    for (let r = tableStartRow + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r)
      const cardSerial = row.getCell(2).text?.trim()
      if (!cardSerial) break
      
      const cardName = row.getCell(3).text?.trim() || ''
      const finish = row.getCell(9).text?.trim() || ''
      
      items.push({
        cardSerial,
        cardName,
        flavorName: row.getCell(4).text?.trim() || '',
        language: row.getCell(5).text?.trim() || 'en',
        cardFrame: row.getCell(6).text?.trim() || '',
        finish,
        setCode: row.getCell(7).text?.trim() || '',
        collectorNumber: row.getCell(8).text?.trim() || '',
        quantity: parseInt(row.getCell(1).text?.trim() || '1', 10),
        isBundle: finish === 'Set' || cardName.endsWith('(Set Bundle)')
      })
    }
  }

  return { header, items }
}
