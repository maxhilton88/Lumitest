/**
 * Sanitizes a string to create a valid URL slug
 * - Converts to lowercase
 * - Removes special characters (keeps letters, numbers, hyphens)
 * - Replaces spaces with hyphens
 * - Removes consecutive hyphens
 * - Trims leading/trailing hyphens
 */
export const sanitizeUrl = (input: string): string => {
  return input
    .toLowerCase() // Convert to lowercase
    .trim() // Remove leading/trailing whitespace
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters (keep letters, numbers, spaces, hyphens)
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace consecutive hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Validates if a URL slug is valid
 */
export const isValidUrlSlug = (slug: string): boolean => {
  if (!slug || slug.length < 3) return false;
  if (slug.length > 50) return false;
  
  // Must start with letter or number
  if (!/^[a-z0-9]/.test(slug)) return false;
  
  // Must end with letter or number
  if (!/[a-z0-9]$/.test(slug)) return false;
  
  // Only lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  
  return true;
};

/**
 * Mock list of taken URLs (in real app, would check database)
 */
const TAKEN_URLS = [
  'little-stars',
  'rainbow-kids',
  'sunshine-kindergarten',
  'happy-tots',
  'bright-beginnings',
  'kids-academy',
  'tiny-treasures'
];

/**
 * Checks if URL is already taken
 * In production, this would be an API call to check database
 */
export const isUrlTaken = (url: string, currentUrl?: string): boolean => {
  // If it's the current URL, it's not taken (user is keeping their URL)
  if (currentUrl && url === currentUrl) return false;
  
  return TAKEN_URLS.includes(url);
};

/**
 * Generates URL suggestions if the desired URL is taken
 */
export const generateUrlSuggestions = (baseUrl: string): string[] => {
  const suggestions: string[] = [];
  
  // Add number suffix
  for (let i = 1; i <= 3; i++) {
    suggestions.push(`${baseUrl}-${i}`);
  }
  
  // Add year suffix
  const year = new Date().getFullYear();
  suggestions.push(`${baseUrl}-${year}`);
  
  // Add location-based suffix
  suggestions.push(`${baseUrl}-kl`);
  suggestions.push(`${baseUrl}-my`);
  
  // Filter out suggestions that are also taken
  return suggestions.filter(url => !isUrlTaken(url));
};

/**
 * Get URL validation message
 */
export const getUrlValidationMessage = (
  url: string,
  currentUrl?: string
): { valid: boolean; message: string; suggestions?: string[] } => {
  if (!url) {
    return { valid: false, message: 'URL is required' };
  }
  
  if (url.length < 3) {
    return { valid: false, message: 'URL must be at least 3 characters' };
  }
  
  if (url.length > 50) {
    return { valid: false, message: 'URL must be less than 50 characters' };
  }
  
  if (!/^[a-z0-9]/.test(url)) {
    return { valid: false, message: 'URL must start with a letter or number' };
  }
  
  if (!/[a-z0-9]$/.test(url)) {
    return { valid: false, message: 'URL must end with a letter or number' };
  }
  
  if (!/^[a-z0-9-]+$/.test(url)) {
    return { valid: false, message: 'URL can only contain lowercase letters, numbers, and hyphens' };
  }
  
  if (isUrlTaken(url, currentUrl)) {
    const suggestions = generateUrlSuggestions(url);
    return {
      valid: false,
      message: 'This URL is already taken',
      suggestions: suggestions.slice(0, 3) // Show top 3 suggestions
    };
  }
  
  return { valid: true, message: 'URL is available!' };
};
