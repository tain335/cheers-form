import { BaseField } from 'cheers-form-core';
import { useCheersFieldState } from './useCheersFieldState';

export function useCheersFieldInput<T extends BaseField<unknown>>(field: T) {
  const [state, valid] = useCheersFieldState(field);
  return {
    valid,
    value: state.$raw,
    onBlur: field.$onBlur.bind(field),
    onChange: field.$onChange.bind(field),
  };
}
