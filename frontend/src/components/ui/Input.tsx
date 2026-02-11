import { InputHTMLAttributes, forwardRef, ReactNode } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className, ...props }, ref) => {
    return (
      <div style={{ width: '100%' }}>
        {label && <label className="form-label">{label}</label>}
        <div style={{ position: 'relative' }}>
          {icon && <div className="form-icon">{icon}</div>}
          <input
            ref={ref}
            className={clsx(
              'form-input',
              icon && 'form-input-with-icon',
              error && 'form-input-error',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        {hint && !error && <p className="form-hint">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
