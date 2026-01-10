import React, { forwardRef } from 'react';
import { Eye, EyeOff, Search, X } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'filled' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  showPasswordToggle?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  className?: string;
}

const inputVariants = {
  default: 'neo-input w-full',
  filled: 'neo-input w-full bg-white',
  outline: 'neo-input w-full bg-transparent',
};

const inputSizes = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-6 py-4 text-lg',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  variant = 'default',
  size = 'md',
  showPasswordToggle = false,
  clearable = false,
  onClear,
  className = '',
  type,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [hasValue, setHasValue] = React.useState(false);

  const inputType = showPasswordToggle && type === 'password'
    ? (showPassword ? 'text' : 'password')
    : type;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasValue(e.target.value.length > 0);
    props.onChange?.(e);
  };

  const handleClear = () => {
    if (props.onChange) {
      const event = {
        target: { value: '' }
      } as React.ChangeEvent<HTMLInputElement>;
      props.onChange(event);
    }
    onClear?.();
    setHasValue(false);
  };

  const baseClasses = inputVariants[variant];
  const sizeClasses = inputSizes[size];

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-black uppercase tracking-widest text-neo-ink mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neo-ink">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          type={inputType}
          className={`
            ${baseClasses}
            ${sizeClasses}
            ${leftIcon ? 'pl-12' : ''}
            ${(rightIcon || showPasswordToggle || (clearable && hasValue)) ? 'pr-12' : ''}
            ${error ? 'bg-red-50 focus:bg-red-100 border-red-500' : ''}
            ${className}
          `}
          onChange={handleChange}
          {...props}
        />

        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {clearable && hasValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-neo-secondary border-2 border-transparent hover:border-black transition-all text-neo-ink"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {showPasswordToggle && type === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="p-1 hover:bg-neo-secondary border-2 border-transparent hover:border-black transition-all text-neo-ink"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          {rightIcon && !showPasswordToggle && !(clearable && hasValue) && (
            <div className="text-neo-ink">
              {rightIcon}
            </div>
          )}
        </div>
      </div>

      {(error || helperText) && (
        <div className="mt-2">
          {error && (
            <p className="text-sm font-bold text-red-600 uppercase tracking-tight">{error}</p>
          )}
          {helperText && !error && (
            <p className="text-sm font-medium text-black/60">{helperText}</p>
          )}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export const SearchInput: React.FC<Omit<InputProps, 'leftIcon' | 'placeholder'>> = (props) => (
  <Input
    leftIcon={<Search className="w-6 h-6 stroke-[3px]" />}
    placeholder="SEARCH..."
    {...props}
  />
);

export const PasswordInput: React.FC<Omit<InputProps, 'type' | 'showPasswordToggle'>> = (props) => (
  <Input
    type="password"
    showPasswordToggle
    {...props}
  />
);

export const EmailInput: React.FC<Omit<InputProps, 'type'>> = (props) => (
  <Input
    type="email"
    {...props}
  />
);

export const NumberInput: React.FC<Omit<InputProps, 'type'>> = (props) => (
  <Input
    type="number"
    {...props}
  />
);

