import { computed } from 'vue';
import { BaseField } from 'cheers-form-core';
import { useCheersFieldState } from './useCheersFieldState';

export function useCheersFieldModel<T extends BaseField<unknown>>(field: T) {
  const state = useCheersFieldState(field);
  return computed({
    get: () => state.value.S.$raw,
    set: (value) => {
      field.$onChange(value);
    },
  });
}
