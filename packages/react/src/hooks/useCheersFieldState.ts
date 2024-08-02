import React, { useEffect, useState } from 'react';
import { BaseField, onSubmitEffects, onUpdated } from 'cheers-form-core';

export function useFieldState<T extends BaseField<unknown>>(field: T) {
  const [state, setState] = useState([field.$state, field.$valid]);
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
