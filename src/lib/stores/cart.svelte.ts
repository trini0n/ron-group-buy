import type { Card } from '$lib/server/types'
import { browser } from '$app/environment'

const CART_STORAGE_KEY = 'group-buy-cart'

interface CartItem {
  card: Card
  quantity: number
}

function createCartStore() {
  let items = $state<CartItem[]>([])

  // Load from localStorage on init
  if (browser) {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
    if (stored) {
      try {
        items = JSON.parse(stored)
      } catch {
        items = []
      }
    }
  }

  // Helper to persist to localStorage
  function persist() {
    if (browser) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    }
  }

  function addItem(card: Card, quantity: number = 1) {
    const existing = items.find((item) => item.card.serial === card.serial)
    if (existing) {
      existing.quantity += quantity
      items = [...items] // Trigger reactivity
    } else {
      items = [...items, { card, quantity }]
    }
    persist()
  }

  function removeItem(serial: string) {
    items = items.filter((item) => item.card.serial !== serial)
    persist()
  }

  function updateQuantity(serial: string, quantity: number) {
    if (quantity <= 0) {
      removeItem(serial)
      return
    }
    const item = items.find((i) => i.card.serial === serial)
    if (item) {
      item.quantity = quantity
      items = [...items] // Trigger reactivity
    }
    persist()
  }

  function clear() {
    items = []
    persist()
  }

  function getTotal(): number {
    return items.reduce((total, item) => {
      const price = item.card.card_type === 'Foil' ? 1.5 : 1.25
      return total + price * item.quantity
    }, 0)
  }

  function getItemCount(): number {
    return items.reduce((count, item) => count + item.quantity, 0)
  }

  return {
    get items() {
      return items
    },
    get total() {
      return getTotal()
    },
    get itemCount() {
      return getItemCount()
    },
    addItem,
    removeItem,
    updateQuantity,
    clear
  }
}

export const cartStore = createCartStore()
