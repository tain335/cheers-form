import React, { useContext, useEffect, useRef } from 'react';
import { BaseField } from 'cheers-form/core';
import { CheersFormContext } from './CheersFormContext';

interface CheersFieldProps<T> {
  name: string;
  children: (field: BaseField<T>) => React.ReactElement;
}

export function CheersField<T>({ name, children }: CheersFieldProps<T>) {
  const elRef = useRef<HTMLElement>(null);
  const context = useContext(CheersFormContext);

  useEffect(() => {
    const scrollCallback = (field: BaseField<unknown>) => {
      if (field === context.form[name] && elRef.current) {
        context.scrollIntoView(elRef.current);
      }
    };
    context.emitter.on('scroll', scrollCallback);
    return () => {
      context.emitter.off('scroll', scrollCallback);
    };
  }, [name, context, elRef.current]);

  return React.cloneElement(children(context.form[name] as BaseField<T>), { ref: elRef });
}
