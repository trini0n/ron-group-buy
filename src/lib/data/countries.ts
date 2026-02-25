export type CountryConfig = {
  iso2: string;
  name: string;
  dialCode: string;
  flag: string;
};

export const countries: CountryConfig[] = [
  { iso2: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
  { iso2: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
  { iso2: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { iso2: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
  { iso2: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪' },
  { iso2: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷' },
  { iso2: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹' },
  { iso2: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸' },
  { iso2: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱' },
  { iso2: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷' },
  { iso2: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽' },
  { iso2: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵' },
  { iso2: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳' },
  { iso2: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' },
  { iso2: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬' },
  { iso2: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾' },
  { iso2: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩' },
  { iso2: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭' },
  { iso2: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭' },
  { iso2: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳' },
  { iso2: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷' },
  { iso2: 'TW', name: 'Taiwan', dialCode: '+886', flag: '🇹🇼' },
  { iso2: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰' },
  { iso2: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿' },
  { iso2: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭' },
  { iso2: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪' },
  { iso2: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴' },
  { iso2: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰' },
  { iso2: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮' },
  { iso2: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪' },
  { iso2: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
  { iso2: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹' },
  { iso2: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪' },
  { iso2: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱' },
  { iso2: 'CZ', name: 'Czech Republic', dialCode: '+420', flag: '🇨🇿' }
];

// Helper to look up country data specifically by full name (since the checkout form uses full names)
export function getCountryByName(name: string): CountryConfig | undefined {
  if (!name) return undefined;
  
  // Normalize checking to handle variations (USA, UK, etc)
  const normalized = name.toUpperCase().trim();
  
  const aliases: Record<string, string> = {
    'USA': 'US',
    'UNITED STATES': 'US',
    'UNITED KINGDOM': 'GB',
    'UK': 'GB',
    'SOUTH KOREA': 'KR'
  };
  
  const targetIso = aliases[normalized];
  if (targetIso) {
    return countries.find(c => c.iso2 === targetIso);
  }
  
  return countries.find(c => c.name.toUpperCase() === normalized);
}
