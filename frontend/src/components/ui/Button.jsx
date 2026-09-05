/**
 * BUTTON COMPONENT — Button.jsx
 * ================================
 * A reusable, accessible button with variants and loading state.
 */

import { FiLoader } from 'react-icons/fi';

const Button = ({
  children,
  variant = 'primary',  // 'primary' | 'secondary' | 'danger'
  type = 'button',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  className = '',
}) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus-visible:outline-none';

  const variants = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    danger:    'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 py-3 px-6 rounded-xl',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        ${baseClasses}
        ${variants[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {/* Show spinner when loading */}
      {isLoading && <FiLoader className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

export default Button;
