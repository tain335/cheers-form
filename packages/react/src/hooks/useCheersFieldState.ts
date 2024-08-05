import { useEffect, useState } from 'react';
import { BaseField, FieldState, ValidType, onUpdated } from 'cheers-form-core';

export function useCheersFieldState<P, T extends BaseField<P>>(field: T): [FieldState<P>, ValidType] {
  const [state, setState] = useState<[FieldState<P>, ValidType]>([field.$state, field.$valid]);
  useEffect(() => {
    const onUpdate = () => {
      setState([field.$state, field.$valid]);
    };
    const uninstall = field.composeHook(() => {
      onUpdated((state, next, source) => {
        onUpdate();
        next(state);
      });
    });
    return uninstall;
  }, [field.$id]);
  return state;
}
