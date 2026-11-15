'use client';

import { forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} className={`input-base ${className}`} {...rest} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return <textarea ref={ref} className={`input-base resize-y ${className}`} {...rest} />;
  }
);

export function Label({
  children,
  htmlFor,
  className = '',
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`mb-1.5 block text-[13px] font-medium text-muted ${className}`}>
      {children}
    </label>
  );
}
