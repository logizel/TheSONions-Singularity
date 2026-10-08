"use client";

import * as React from "react";
import * as FormPrimitive from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";

export interface FormProps<T extends Record<string, unknown>> extends React.ComponentPropsWithoutRef<"form"> {
  resolver?: FormPrimitive.Resolver<T>;
  defaultValues?: FormPrimitive.DefaultValues<T>;
  onSubmit?: FormPrimitive.SubmitHandler<T>;
}

export interface UseFormReturn<T extends Record<string, unknown>> extends FormPrimitive.UseFormReturn<T> {}

export function Form<T extends Record<string, unknown>>({
  resolver,
  defaultValues,
  onSubmit,
  children,
  ...props
}: FormProps<T>) {
  const form = FormPrimitive.useForm<T>({
    resolver,
    defaultValues,
  });

  const onSubmitHandler = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      form.handleSubmit(onSubmit)(e);
    },
    [form, onSubmit]
  );

  return (
    <FormPrimitive.FormProvider {...form}>
      <form onSubmit={onSubmitHandler} {...props}>
        {children}
      </form>
    </FormPrimitive.FormProvider>
  );
}

export const FormField = FormPrimitive.Field;
export const FormItem = FormPrimitive.FormItem;
export const FormLabel = FormPrimitive.FormLabel;
export const FormControl = FormPrimitive.FormControl;
export const FormDescription = FormPrimitive.FormDescription;
export const FormMessage = FormPrimitive.FormMessage;

export const useForm = FormPrimitive.useForm;
export const useFormContext = FormPrimitive.useFormContext;
export const useFormField = FormPrimitive.useFormField;
export const zodResolver;