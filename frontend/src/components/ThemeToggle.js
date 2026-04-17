import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = ({ compact = true, className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${compact ? 'theme-toggle-btn--compact' : ''} ${className}`.trim()}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema noturno'}
      title={isDark ? 'Ativar tema claro' : 'Ativar tema noturno'}
    >
      {isDark ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-slate-700" />}
      {!compact ? <span>{isDark ? 'Tema claro' : 'Tema noturno'}</span> : null}
    </button>
  );
};

export default ThemeToggle;
