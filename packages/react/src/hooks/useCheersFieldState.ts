import React, { useEffect, useState } from 'react';
import { BaseField } from 'cheers-form-core';

export function useFieldState<T extends BaseField<unknown>>(field: T) {
  const [state, setState] = useState([field.$state, field.$valid]);
  useEffect(() => {
    const onUpdate = () => {
      setState([field.$state, field.$valid]);
    };
    field.$emitter.on('update', onUpdate);
    return () => field.$emitter.off('update', onUpdate);
  }, [field.$id]);
  return state;
}
