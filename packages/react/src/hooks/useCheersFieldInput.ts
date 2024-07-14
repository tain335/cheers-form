import React from 'react';
import { BaseField } from 'cheers-form/core';
import { useFieldState } from './useCheersFieldState';

export function useFieldInput<T extends BaseField<unknown>>(field: T) {
  const state = useFieldState(field);
  return {
    ...state,
    onBlur: field.$onBlur.bind(field),
    onChange: field.$onChange.bind(field),
  };
}
