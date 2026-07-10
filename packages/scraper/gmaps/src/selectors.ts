/**
 * Google Maps selectors — prefer data-item-id and role/aria attributes
 * over class names (which are obfuscated and change frequently).
 */
export const SELECTORS = {
  SEARCH_INPUT: '#searchboxinput',
  RESULTS_FEED: 'div[role="feed"]',
  LISTING_LINK: 'div[role="feed"] a[href*="/maps/place/"]',
  BUSINESS_NAME: 'h1',
  RATING: 'div.F7nice span[aria-hidden="true"]',
  REVIEW_COUNT: 'div.F7nice span[aria-label]',
  ADDRESS: '[data-item-id="address"] .fontBodyMedium',
  PHONE: '[data-item-id*="phone"] .fontBodyMedium',
  WEBSITE: '[data-item-id="authority"] .fontBodyMedium',
  HOURS_BUTTON: '[data-item-id*="oh"] button, [aria-label*="hours"]',
  HOURS_TABLE: 'table.eK4R0e tr',
  CATEGORY_BUTTON: 'button[jsaction*="category"]',
  IMAGES: 'button[jsaction*="photo"] img, div.RZ66Rb img',
  END_OF_LIST: 'p.fontBodyMedium span',
  COOKIE_ACCEPT: 'button:has-text("Accept all")',
} as const;
