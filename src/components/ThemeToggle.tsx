import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
  showLabel?: boolean;
  responsiveLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  compact = false,
  className = '',
  showLabel = true,
  responsiveLabel = false,
}) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Passa al tema Chiaro (Sfondo Bianco & Blu)' : 'Passa al tema Scuro (Nero & Giallo)'}
      title={isDark ? 'Passa al tema Chiaro (Sfondo Bianco & Blu)' : 'Passa al tema Scuro (Nero & Giallo)'}
      className={`relative inline-flex items-center gap-1.5 sm:gap-2 rounded-lg transition-all cursor-pointer select-none touch-manipulation touch-active shrink-0 ${
        compact
          ? 'w-9 h-9 sm:w-10 sm:h-10 justify-center p-0'
          : responsiveLabel
          ? 'w-[34px] h-[34px] sm:w-9 sm:h-9 p-0 justify-center 2xl:w-auto 2xl:h-auto 2xl:px-3 2xl:py-1.5 2xl:justify-start'
          : 'px-2.5 sm:px-3 py-1.5'
      } ${
        isDark
          ? 'bg-neutral-900/90 text-yellow-300 border border-yellow-500/35 hover:border-yellow-400 hover:bg-neutral-800 shadow-sm'
          : 'bg-white text-blue-600 border border-blue-200 hover:border-blue-400 hover:bg-blue-50 shadow-sm'
      } ${className}`}
    >
      <div className="relative flex items-center justify-center w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0">
        {isDark ? (
          <Sun className="w-4 h-4 text-yellow-400 animate-in spin-in-90 zoom-in duration-200" />
        ) : (
          <Moon className="w-4 h-4 text-blue-600 animate-in spin-in-90 zoom-in duration-200" />
        )}
      </div>

      {!compact && showLabel && (
        <span
          className={`text-xs font-bold whitespace-nowrap ${
            responsiveLabel ? 'hidden 2xl:inline' : 'inline'
          }`}
        >
          {isDark ? 'Tema Chiaro' : 'Tema Scuro'}
        </span>
      )}
    </button>
  );
};
