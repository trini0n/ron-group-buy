// Admin shared constants (can be used on client and server)
// No server-only imports here!

// Discord IDs that have admin access
export const ADMIN_DISCORD_IDS = [
  '83470831350448128', // Owner
  '431606995100106762' // Seller
] as const

export type AdminDiscordId = (typeof ADMIN_DISCORD_IDS)[number]

/**
 * Check if a Discord ID has admin access
 */
export function isAdminDiscordId(discordId: string | null | undefined): boolean {
  if (!discordId) return false
  return ADMIN_DISCORD_IDS.includes(discordId as AdminDiscordId)
}

/**
 * Order status labels and colors for display
 */
export const ORDER_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    description: 'Order submitted, awaiting invoice'
  },
  invoiced: {
    label: 'Invoiced',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    description: 'PayPal invoice sent, awaiting payment'
  },
  paid: {
    label: 'Paid',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    description: 'Payment received, awaiting processing'
  },
  processing: {
    label: 'Processing',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    description: 'Order is being prepared'
  },
  shipped: {
    label: 'Shipped',
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
    description: 'Order has been shipped'
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
    description: 'Order delivered'
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    description: 'Order was cancelled'
  }
} as const

export type OrderStatus = keyof typeof ORDER_STATUS_CONFIG

/**
 * Get the next logical status for an order
 */
export function getNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
  switch (currentStatus) {
    case 'pending':
      return ['invoiced', 'cancelled']
    case 'invoiced':
      return ['paid', 'cancelled']
    case 'paid':
      return ['processing', 'cancelled']
    case 'processing':
      return ['shipped', 'cancelled']
    case 'shipped':
      return ['delivered']
    case 'delivered':
      return []
    case 'cancelled':
      return ['pending'] // Allow reactivation
    default:
      return []
  }
}
