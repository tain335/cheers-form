import React, { useContext, useEffect, useRef } from 'react';
import { BaseField, FormType } from 'cheers-form-core';
import { CheersFormContext } from './CheersFormContext';
import { useCheersFieldState } from '../hooks/useCheersFieldState';

interface CheersFieldProps<T> {
  name: string;
  children: (field: BaseField<T>) => React.ReactElement;
}

function targetField(form: FormType<Record<string, any>>, name: string) {
  if (name === '*') {
    return form as BaseField<unknown>;
  }
  const fieldNames = name.split('.');
  let field: any = form;
  while (fieldNames.length) {
    const fieldName = fieldNames.shift();
    if (fieldName === '$') {
      field = field.$parent;
    } else {
      field = field[fieldName as string];
    }
  }
  return field as BaseField<unknown>;
}

export function CheersField<T>({ name, children }: CheersFieldProps<T>) {
  const elRef = useRef<HTMLElement>(null);
  const context = useContext(CheersFormContext);
  const tfield = targetField(context.form, name);
  useEffect(() => {
    const scrollCallback = (field: BaseField<unknown>) => {
      if (field === tfield && elRef.current) {
        context.scrollIntoView(elRef.current);
      }
    };
    context.emitter.on('scroll', scrollCallback);
    return () => {
      context.emitter.off('scroll', scrollCallback);
    };
  }, [tfield, elRef.current]);
  useCheersFieldState(tfield);
  return React.cloneElement(children(tfield as BaseField<T>), {
    ref: elRef,
  });
}
