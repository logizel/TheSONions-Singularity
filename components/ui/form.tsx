"use client";

import * as React from "react";

export interface FormProps<T extends Record<string, unknown>> extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  onSubmit?: (data: T) => void;
}

export function Form<T extends Record<string, unknown>>({
  onSubmit,
  children,
  ...props
}: React.FormHTMLAttributes<HTMLFormElement> & { onSubmit?: (data: T) => void }) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    if (onSubmit) {
      onSubmit(data as T);
    }
  };

  return (
    <form onSubmit={handleSubmit} {...props}>
      {children}
    </form>
  );
}

export const FormField = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props}>{children}</div>
);

export const FormItem = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props}>{children}</div>
);

export const FormLabel = ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{children}</label>
);

export const FormControl = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props}>{children}</div>
);

export const FormDescription = ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

export const FormMessage = ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className="text-sm text-destructive">{children}</p>
);

export const useForm = () => ({
  register: () => ({}),
  handleSubmit: (fn: (data: unknown) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    return fn(data);
  },
  watch: () => ({}),
  setValue: () => {},
  reset: () => {},
  formState: { errors: {}, isSubmitting: false },
});

export function zodResolver<T>(schema: any) {
  return (values: unknown) => {
    const result = schema.safeParse(values);
    if (!result.success) {
      return { errors: result.error.flatten().fieldErrors };
    }
    return { values: result.data };
  };
}