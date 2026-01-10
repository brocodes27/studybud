import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'ghost' | 'outline' | 'muted' | 'white';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
  className?: string;
  shadow?: 'sm' | 'md' | 'lg';
}

const buttonVariants = {
  primary: 'neo-button',
  secondary: 'neo-button-secondary',
  accent: 'neo-button', // same as primary/accent in neo style
  muted: 'neo-button-muted',
  white: 'neo-button-white',
  success: 'neo-button bg-green-400',
  warning: 'neo-button bg-yellow-400',
  danger: 'neo-button bg-red-500',
  ghost: 'bg-transparent hover:bg-black/5 font-bold uppercase tracking-wider px-4 py-2 transition-all',
  outline: 'neo-border bg-transparent hover:bg-black/5 font-bold uppercase tracking-wider px-4 py-2 transition-all',
};

const buttonSizes = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
  xl: 'px-10 py-5 text-lg',
};

const shadowSizes = {
  sm: 'shadow-[2px_2px_0px_0px_#000]',
  md: 'shadow-[4px_4px_0px_0px_#000]',
  lg: 'shadow-[6px_6px_0px_0px_#000]',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  children,
  className = '',
  disabled,
  shadow = 'md',
  ...props
}) => {
  const baseClasses = buttonVariants[variant as keyof typeof buttonVariants] || buttonVariants.primary;
  const sizeClasses = buttonSizes[size];
  const shadowClasses = shadowSizes[shadow];
  const isDisabled = disabled || loading;

  return (
    <button
      className={`
        ${baseClasses}
        ${sizeClasses}
        ${variant !== 'ghost' ? shadowClasses : ''}
        ${isDisabled ? 'opacity-60 cursor-not-allowed grayscale' : ''}
        ${className}
      `}
      disabled={isDisabled}
      {...props}
    >
      <div className="flex items-center justify-center gap-2">
        {loading && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        {!loading && icon && iconPosition === 'left' && (
          <span className="flex-shrink-0">{icon}</span>
        )}
        <span className="font-black">{children}</span>
        {!loading && icon && iconPosition === 'right' && (
          <span className="flex-shrink-0">{icon}</span>
        )}
      </div>
    </button>
  );
};

export const PrimaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="primary" {...props} />
);

export const SecondaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="secondary" {...props} />
);

export const AccentButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="muted" {...props} />
);

export const SuccessButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="success" {...props} />
);

export const WarningButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="warning" {...props} />
);

export const DangerButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="danger" {...props} />
);

export const GhostButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="ghost" {...props} />
);

export const OutlineButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="outline" {...props} />
);

