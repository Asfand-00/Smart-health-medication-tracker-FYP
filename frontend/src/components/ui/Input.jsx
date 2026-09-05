/**
 * INPUT COMPONENT — Input.jsx
 * =============================
 * A reusable form input with label, icon support, and error display.
 * Used on Login and Register pages.
 */

import { forwardRef, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

/**
 * forwardRef allows parent components to access the input DOM element directly.
 * Needed for react-hook-form and focus management.
 */
const Input = forwardRef(({
  label,
  id,
  type = 'text',
  placeholder,
  error,
  icon: Icon,    // React icon component (e.g., FiMail)
  className = '',
  ...rest        // All other input props (onChange, onBlur, value, etc.)
}, ref) => {
  // State for password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  // Determine actual input type (toggle text/password)
  const inputType = type === 'password'
    ? (showPassword ? 'text' : 'password')
    : type;

  return (
    <div className={`w-full ${className}`}>
      {/* Label */}
      {label && (
        <label htmlFor={id} className="input-label">
          {label}
        </label>
      )}

      {/* Input wrapper with icon support */}
      <div className="relative">
        {/* Left icon */}
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Icon className="w-4 h-4 text-white/30" />
          </div>
        )}

        <input
          ref={ref}
          id={id}
          type={inputType}
          placeholder={placeholder}
          className={`
            input-field
            ${Icon ? 'pl-10' : ''}
            ${type === 'password' ? 'pr-10' : ''}
            ${error ? 'border-red-500/50 focus:border-red-500' : ''}
          `}
          {...rest}
        />

        {/* Password toggle button */}
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(prev => !prev)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/30 hover:text-white/70 transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="input-error">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
