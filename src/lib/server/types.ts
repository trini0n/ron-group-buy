import type { Database } from './database.types';

// Convenience type aliases
export type Card = Database['public']['Tables']['cards']['Row'];
export type CardInsert = Database['public']['Tables']['cards']['Insert'];

export type User = Database['public']['Tables']['users']['Row'];
export type Address = Database['public']['Tables']['addresses']['Row'];
export type Cart = Database['public']['Tables']['carts']['Row'];
export type CartItem = Database['public']['Tables']['cart_items']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type GroupBuyConfig = Database['public']['Tables']['group_buy_config']['Row'];

export type OrderStatus = Database['public']['Enums']['order_status'];

// Extended types with relations
export type CartItemWithCard = CartItem & {
  card: Card;
};

export type OrderWithItems = Order & {
  order_items: OrderItem[];
};

// Filter types for card catalog
export interface CardFilters {
  search?: string;
  setCode?: string;
  colorIdentity?: string[];
  cardType?: 'Normal' | 'Holo' | 'Foil';
  inStockOnly?: boolean;
  isNew?: boolean;
  typeLineContains?: string;
}

// Pagination
export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Deck import types
export interface ParsedDeckCard {
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  moxfieldSyntax?: string;
  hasFoilFlag?: boolean;
}

export interface DeckImportResult {
  exactMatches: Array<{ parsed: ParsedDeckCard; card: Card }>;
  alternatives: Array<{ parsed: ParsedDeckCard; cards: Card[] }>;
  notFound: ParsedDeckCard[];
}
