import { getCurrentInstance, ref, shallowRef, watchEffect } from 'vue';

import { BaseField, onUpdated } from 'cheers-form-core';

export function useCheersFieldState<T extends BaseField<unknown>>(field: T) {
  const state = shallowRef({ S: field.$state, valid: field.$valid });
  const instance = getCurrentInstance();
  watchEffect((onCleanup) => {
    const onUpdate = () => {
      state.value = { S: field.$state, valid: field.$valid };
      instance?.proxy?.$forceUpdate();
    };
    const uninstall = field.composeHook(() => {
      onUpdated((state, next, source) => {
        onUpdate();
        next(state);
      });
    });
    onCleanup(() => {
      uninstall();
    });
  });
  return state;
}
