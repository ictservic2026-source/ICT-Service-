'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { dark, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} aria-label={dark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'} title={dark ? 'โหมดสว่าง' : 'โหมดมืด'}
      className={`rounded-lg p-2 text-sub transition hover:bg-surface-3 hover:text-ink ${className}`}>
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
