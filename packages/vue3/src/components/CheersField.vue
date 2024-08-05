<template>
  <slot ref="el" :field="tfield" :proxy="proxy"></slot>
</template>
<script lang="ts" setup>
import { getCurrentInstance, inject, onMounted, onUnmounted } from 'vue';
import { CheersFormContext } from './CheersFormContext';
import { BaseField, FormType, onUpdated, targetField } from 'cheers-form-core';
import { useCheersFieldModel } from '../hooks/useCheersFieldModel';

const props = defineProps<{name: string}>()

const form = inject<CheersFormContext<Record<string, any>>>('form');
const tfield = targetField(form?.instance as FormType<Record<string, any>>, props.name ?? '');
const instance = getCurrentInstance();

const model = useCheersFieldModel(tfield);

const proxy = {
  model: model.value,
}

Object.defineProperty(proxy, 'model', {
  get: ()=> model.value,
  set: (v)=> {
    model.value = v
  },
})

const onScroll = (field: BaseField<unknown>)=> {
  if(field === tfield && instance?.refs['el']) {
    form?.scrollIntoView(instance?.refs['el'] as HTMLElement)
  }
}

onMounted(()=> {
  form?.emitter.on('scroll', onScroll)
})

onUnmounted(()=> {
  form?.emitter.off('scroll', onScroll)
})
</script>