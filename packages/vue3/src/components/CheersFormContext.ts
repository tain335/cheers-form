import { FormType } from 'cheers-form-core';
import { Emitter } from 'mitt';
import { FormEvents } from './FormEvents';

export type CheersFormContext<T extends Record<string, any>> = {
  el: HTMLElement;
  instance: FormType<T>;
  emitter: Emitter<FormEvents>;
  scrollIntoView: (el: HTMLElement) => void;
};
