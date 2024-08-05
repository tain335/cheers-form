<template>
  <input v-model="model" :type="type" :class="{error: valid === ValidType.Invalid }"></input>
  <div :class="{error: valid === ValidType.Invalid }">{{ message }}</div>
</template>
<script lang="ts" setup>
import { ValidType } from 'cheers-form-core';
defineProps<{
  message?: string
  type?: string;
  valid?: ValidType
}>()
const model = defineModel<string>();
const emits = defineEmits(['blur'])
</script>