import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCamelotColor(key: string): string {
  if (!key) return '#888888';
  
  // Base HSL hues for Camelot Wheel 1 to 12
  // 1=B, 2=F#, 3=Db, 4=Ab, 5=Eb, 6=Bb, 7=F, 8=C, 9=G, 10=D, 11=A, 12=E
  // The colors typically cycle through the spectrum. Let's map standard hexes:
  const camelotColors: Record<string, string> = {
    // Minor (A)
    '1A': '#01dca4', // Turquoise
    '2A': '#39d57a', // Green
    '3A': '#6ed44a', // Light Green
    '4A': '#a1d120', // Lime
    '5A': '#d6d200', // Yellow
    '6A': '#e8a900', // Orange-Yellow
    '7A': '#fa7a00', // Orange
    '8A': '#fc4126', // Red
    '9A': '#fe0252', // Pink
    '10A': '#eb028a', // Magenta
    '11A': '#a713c7', // Purple
    '12A': '#571cfd', // Blue
    // Major (B)
    '1B': '#31efb7',
    '2B': '#5feed5',
    '3B': '#87eebb',
    '4B': '#aff1a3',
    '5B': '#dcf589',
    '6B': '#ffc562',
    '7B': '#ffa954',
    '8B': '#ff8067',
    '9B': '#ff5086',
    '10B': '#ff60af',
    '11B': '#c964e5',
    '12B': '#8271ff'
  };

  return camelotColors[key.toUpperCase()] || '#888888';
}

