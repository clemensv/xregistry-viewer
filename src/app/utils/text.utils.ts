/**
 * Text and formatting utilities
 */

/**
 * Truncates text to specified length and adds ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string | null | undefined, maxLength: number = 60): string {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Truncates description text to specified length
 * @param description Description text to truncate
 * @param maxLength Maximum length before truncation (default 200)
 * @returns Truncated description with ellipsis if needed
 */
export function truncateDescription(description: string | null | undefined, maxLength: number = 200): string {
  if (!description) return '-';
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength - 3) + '...';
}

/**
 * Formats a date string using the user's locale and timezone
 * @param dateString ISO date string
 * @param locale User's locale (default: browser locale)
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDate(
  dateString: string | null | undefined,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    };
    
    const formatOptions = { ...defaultOptions, ...options };
    const userLocale = locale || navigator.language || 'en-US';
    
    return new Intl.DateTimeFormat(userLocale, formatOptions).format(date);
  } catch (error) {
    console.warn('Date formatting error:', error);
    return dateString;
  }
}

/**
 * Formats a date string in short format using the user's locale
 * @param dateString ISO date string
 * @param locale User's locale (default: browser locale)
 * @returns Short formatted date string
 */
export function formatDateShort(
  dateString: string | null | undefined,
  locale?: string
): string {
  return formatDate(dateString, locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Gets the full text for display in tooltips
 * @param text Text to display
 * @returns Original text or empty string if null/undefined
 */
export function getFullText(text: string | null | undefined): string {
  return text || '';
} 