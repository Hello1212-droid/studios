/**
 * cn() — Tailwind CSS class merger utility.
 *
 * Combines clsx (conditional class logic) with tailwind-merge
 * (resolves conflicting Tailwind classes, e.g., p-4 p-6 → p-6).
 *
 * Example:
 *   cn('px-4', isActive && 'bg-blue-500', className)
 *   → 'px-4 bg-blue-500' (with any conflicts resolved)
 */

import { clsx, type ClassValue } from "clsx";   // Conditional class strings
import { twMerge } from "tailwind-merge";        // Tailwind class deduplication

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
