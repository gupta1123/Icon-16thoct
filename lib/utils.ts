import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeTo12Hour(timeString: string): string {
  if (!timeString) return '';
  
  try {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    
    return format(date, 'h:mm a');
  } catch (error) {
    console.error('Error formatting time:', error);
    return timeString;
  }
}

export function formatDateToUserFriendly(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = parseISO(dateString);
    
    return format(date, 'MMM dd, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

export function formatLastUpdated(lastUpdatedString: string): string {
  if (!lastUpdatedString) return '';
  
  try {
    let date: Date;
    
    if (lastUpdatedString.includes('T')) {
      date = parseISO(lastUpdatedString);
    } else {
      const parts = lastUpdatedString.split(' ');
      if (parts.length >= 2) {
        const datePart = parts[0];
        const timePart = parts[1];
        
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        
        date = new Date(year, month - 1, day, hours, minutes);
      } else {
        date = parseISO(lastUpdatedString);
      }
    }
    
    const formattedDate = formatDateToUserFriendly(format(date, 'yyyy-MM-dd'));
    const formattedTime = formatTimeTo12Hour(format(date, 'HH:mm'));
    
    return `${formattedDate} ${formattedTime}`;
  } catch (error) {
    console.error('Error formatting last updated:', error);
    return lastUpdatedString;
  }
}
