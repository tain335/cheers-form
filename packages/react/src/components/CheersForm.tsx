import React, { useContext, useImperativeHandle, useMemo, useRef } from 'react';
import { BaseField, FormType } from 'cheers-form/core';
import mitt from 'mitt';
import { CheersFormContext, CheersFormContextValue, FormEvents } from './CheersFormContext';

interface CheersFormProps<T extends Record<string, any>> {
  form: FormType<T>;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onScrollIntoView?: (el: HTMLElement) => void;
}

interface FormInstance<T extends Record<string, any>> {
  el: HTMLFormElement | null;
  instance: FormType<T>;
  scrollTo: (field: BaseField<unknown>) => void;
}

export const CheersForm = React.forwardRef(
  <T extends Record<string, any>>(
    { form, children, style, className, onScrollIntoView }: CheersFormProps<T>,
    ref: React.Ref<FormInstance<T>>,
  ) => {
    const parentContext = useContext(CheersFormContext);
    const formRef = useRef<HTMLFormElement>(null);
    const providerValue = useMemo(() => {
      return {
        form,
        emitter: parentContext ? parentContext.emitter : mitt<FormEvents>(),
        scrollIntoView: onScrollIntoView ?? ((el: HTMLElement) => el.scrollIntoView({ behavior: 'smooth' })),
      } as CheersFormContextValue<FormEvents>;
    }, [form, parentContext]);
    useImperativeHandle(
      ref,
      () => {
        return {
          el: formRef.current,
          instance: form,
          scrollTo(field: BaseField<unknown>) {
            providerValue.emitter.emit('scroll', field);
          },
        };
      },
      [form, formRef.current],
    );
    return (
      <CheersFormContext.Provider value={providerValue}>
        <form className={className} ref={formRef} style={style}>
          {children}
        </form>
      </CheersFormContext.Provider>
    );
  },
);
