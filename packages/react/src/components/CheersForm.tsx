import React, { RefAttributes, useContext, useImperativeHandle, useMemo, useRef } from 'react';
import { BaseField, FormType } from 'cheers-form-core';
import mitt from 'mitt';
import { CheersFormContext, CheersFormContextValue, FormEvents } from './CheersFormContext';
import { useCheersFieldState } from '../hooks/useCheersFieldState';

interface CheersFormProps<T extends Record<string, any>> {
  form: FormType<T>;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onScrollIntoView?: (el: HTMLElement) => void;
}

interface FormInstanceRef<T extends Record<string, any>> {
  el: HTMLDivElement | null;
  instance: FormType<T>;
  scrollTo: (field: BaseField<unknown>) => void;
}

export const CheersForm = React.forwardRef(
  <T extends Record<string, any>>(
    { form, children, style, className, onScrollIntoView }: CheersFormProps<T>,
    ref: React.Ref<FormInstanceRef<T>>,
  ) => {
    const parentContext = useContext(CheersFormContext);
    const formRef = useRef<HTMLDivElement>(null);
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
    useCheersFieldState(form as BaseField<unknown>);
    return (
      <CheersFormContext.Provider value={providerValue}>
        <div className={className} ref={formRef} style={style}>
          {children}
        </div>
      </CheersFormContext.Provider>
    );
  },
  // 实现React.forwardRef泛型类型
) as <T extends Record<string, any>>(props: CheersFormProps<T> & RefAttributes<FormInstanceRef<T>>) => JSX.Element;
