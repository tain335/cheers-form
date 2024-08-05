<template>
  <div ref="el">
    <slot></slot>
  </div>
</template>
<script lang="ts" setup generic="T extends Record<string, any>">
import { BaseField, FormType } from 'cheers-form-core';
import { getCurrentInstance, onUpdated, provide } from 'vue';
import mitt from 'mitt';
import { useCheersFieldState } from '../hooks/useCheersFieldState';
import { CheersFormContext } from './CheersFormContext';
import { FormEvents } from './FormEvents';

const props = defineProps<{
  form: FormType<T>;
  onScrollIntoView?: (el: HTMLElement) => void;
}>();
const instance = getCurrentInstance();
const emitter = mitt<FormEvents>();

provide<CheersFormContext<T>>('form', {
  el: instance?.refs['el'] as HTMLElement,
  emitter: emitter,
  instance: props.form,
  scrollIntoView: (el: HTMLElement)=> props?.onScrollIntoView?.(el)
});

defineExpose({
  scrollTo: (field: BaseField<unknown>)=> emitter.emit('scroll', field)
})

useCheersFieldState(props.form as BaseField<unknown>);
</script>