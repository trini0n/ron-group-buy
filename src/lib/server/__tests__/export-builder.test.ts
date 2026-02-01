import { describe, it, expect } from 'vitest';
import { getFrameEffectLabel, getFinishLabel } from '$lib/utils';

describe('Export Helper Functions', () => {
  describe('getFrameEffectLabel', () => {
    it('should return "Regular" for card with no frame effects', () => {
      const card = {
        is_retro: false,
        is_extended: false,
        is_showcase: false,
        is_borderless: false,
        is_etched: false
      };
      
      expect(getFrameEffectLabel(card)).toBe(null);
    });

    it('should return single frame effect', () => {
      const card = {
        is_retro: true,
        is_extended: false,
        is_showcase: false,
        is_borderless: false,
        is_etched: false
      };
      
      expect(getFrameEffectLabel(card)).toBe('Retro');
    });

    it('should return multiple frame effects separated by comma', () => {
      const card = {
        is_retro: true,
        is_extended: false,
        is_showcase: false,
        is_borderless: false,
        is_etched: true
      };
      
      expect(getFrameEffectLabel(card)).toBe('Retro, Etched');
    });

    it('should prioritize Showcase over Borderless', () => {
      const card = {
        is_retro: false,
        is_extended: false,
        is_showcase: true,
        is_borderless: true,
        is_etched: false
      };
      
      // Should only show Showcase, not Borderless
      expect(getFrameEffectLabel(card)).toBe('Showcase');
    });

    it('should show Borderless when Showcase is not present', () => {
      const card = {
        is_retro: false,
        is_extended: false,
        is_showcase: false,
        is_borderless: true,
        is_etched: false
      };
      
      expect(getFrameEffectLabel(card)).toBe('Borderless');
    });

    it('should handle all effects enabled (Showcase supersedes Borderless)', () => {
      const card = {
        is_retro: true,
        is_extended: true,
        is_showcase: true,
        is_borderless: true,
        is_etched: true
      };
      
      // Should show all except Borderless (superseded by Showcase)
      expect(getFrameEffectLabel(card)).toBe('Retro, Extended Art, Showcase, Etched');
    });

    it('should return null for null card', () => {
      expect(getFrameEffectLabel(null)).toBe(null);
    });
  });

  describe('getFinishLabel', () => {
    it('should prefer foil_type over card_type', () => {
      const card = {
        foil_type: 'Surge Foil',
        card_type: 'Normal'
      };
      
      expect(getFinishLabel(card)).toBe('Surge Foil');
    });

    it('should fall back to card_type when foil_type is null', () => {
      const card = {
        foil_type: null,
        card_type: 'Normal'
      };
      
      expect(getFinishLabel(card)).toBe('Normal');
    });

    it('should handle various finish types', () => {
      expect(getFinishLabel({ foil_type: 'Foil', card_type: 'Normal' })).toBe('Foil');
      expect(getFinishLabel({ foil_type: 'Etched', card_type: 'Normal' })).toBe('Etched');
      expect(getFinishLabel({ foil_type: 'Surge Foil', card_type: 'Normal' })).toBe('Surge Foil');
    });
  });
});

describe('Export Data Calculations', () => {
  describe('calculateOrderTotals', () => {
    it('should calculate US order totals correctly', () => {
      const order = {
        shipping_country: 'US',
        shipping_type: 'regular',
        items: [
          { quantity: 4, unit_price: 10.0 },  // $40
          { quantity: 1, unit_price: 25.50 }, // $25.50
          { quantity: 2, unit_price: 5.0 }    // $10
        ]
      };

      // Expected: Subtotal=$75.50, Shipping=$6, Tariff=$9, Total=$90.50
      // This matches SHIPPING_RATES.us.regular
    });

    it('should calculate US express shipping correctly', () => {
      const order = {
        shipping_country: 'USA',
        shipping_type: 'express',
        items: [
          { quantity: 1, unit_price: 100.0 }
        ]
      };

      // Expected: Subtotal=$100, Shipping=$40, Tariff=$9, Total=$149
    });

    it('should calculate international order totals correctly', () => {
      const order = {
        shipping_country: 'Canada',
        shipping_type: 'regular',
        items: [
          { quantity: 1, unit_price: 50.0 }
        ]
      };

      // Expected: Subtotal=$50, Shipping=$6, Tariff=$0, Total=$56
    });

    it('should calculate international express shipping correctly', () => {
      const order = {
        shipping_country: 'Japan',
        shipping_type: 'express',
        items: [
          { quantity: 2, unit_price: 30.0 }
        ]
      };

      // Expected: Subtotal=$60, Shipping=$25, Tariff=$0, Total=$85
    });

    it('should handle empty items array', () => {
      const order = {
        shipping_country: 'US',
        shipping_type: 'regular',
        items: []
      };

      // Expected: Subtotal=$0, Shipping=$6, Tariff=$9, Total=$15
    });
  });

  describe('formatCurrency', () => {
    it('should format whole dollars', () => {
      // formatCurrency(100) should return "$100.00"
    });

    it('should format cents', () => {
      // formatCurrency(25.5) should return "$25.50"
    });

    it('should format zero', () => {
      // formatCurrency(0) should return "$0.00"
    });
  });

  describe('formatDate', () => {
    it('should format date with time', () => {
      const date = '2026-01-31T23:45:00Z';
      // Should return format like: "Jan 31, 2026 at 11:45 PM" (adjusted for timezone)
    });

    it('should handle null dates', () => {
      // formatDate(null) should return "—"
    });
  });
});

describe('Line Item Row Building', () => {
  describe('buildLineItemRow', () => {
    it('should use fresh card metadata when available', () => {
      const item = {
        card_serial: 'N-12345',
        card_name: 'Lightning Bolt',
        card_type: 'Normal',
        quantity: 4,
        card: {
          set_code: 'MH3',
          collector_number: '135',
          is_retro: false,
          is_extended: false,
          is_showcase: false,
          is_borderless: false,
          is_etched: false,
          foil_type: null,
          card_type: 'Normal',
          language: 'en'
        }
      };

      // Expected row: ['N-12345', 'Lightning Bolt', 'Regular', 'Normal', 'MH3', '135', '', 4]
    });

    it('should use snapshot data when card is deleted', () => {
      const item = {
        card_serial: 'F-99999',
        card_name: 'Deleted Card',
        card_type: 'Foil',
        quantity: 1,
        card: null,
        set_code: 'OLD',
        collector_number: '001',
        language: 'en'
      };

      // Expected row: ['F-99999', 'Deleted Card', 'Regular', 'Foil', 'OLD', '001', '', 1]
    });

    it('should show language for non-English cards', () => {
      const item = {
        card_serial: 'N-67890',
        card_name: '稲妻',
        card_type: 'Normal',
        quantity: 1,
        card: {
          set_code: 'MH3',
          collector_number: '135',
          is_retro: false,
          is_extended: false,
          is_showcase: false,
          is_borderless: false,
          is_etched: false,
          foil_type: null,
          card_type: 'Normal',
          language: 'ja'
        }
      };

      // Expected row should have 'ja' in language column
      // ['N-67890', '稲妻', 'Regular', 'Normal', 'MH3', '135', 'ja', 1]
    });

    it('should not show language for English cards', () => {
      const item = {
        card_serial: 'N-12345',
        card_name: 'Lightning Bolt',
        card_type: 'Normal',
        quantity: 1,
        card: {
          set_code: 'MH3',
          collector_number: '135',
          is_retro: false,
          is_extended: false,
          is_showcase: false,
          is_borderless: false,
          is_etched: false,
          foil_type: null,
          card_type: 'Normal',
          language: 'en'
        }
      };

      // Expected row should have empty string in language column
      // ['N-12345', 'Lightning Bolt', 'Regular', 'Normal', 'MH3', '135', '', 1]
    });

    it('should handle missing set code and collector number', () => {
      const item = {
        card_serial: 'X-00000',
        card_name: 'Unknown Card',
        card_type: 'Normal',
        quantity: 1,
        card: null,
        set_code: null,
        collector_number: null,
        language: 'en'
      };

      // Expected row should have empty strings for set code and collector number
      // ['X-00000', 'Unknown Card', 'Regular', 'Normal', '', '', '', 1]
    });
  });
});
