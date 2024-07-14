import React from 'react';
import { BaseField, Form, FormType } from 'cheers-form/core';
import mitt, { Emitter, EventType } from 'mitt';

export interface CheersFormContextValue<Events extends Record<EventType, unknown>> {
  form: FormType<Record<string, any>>;
  emitter: Emitter<Events>;
  scrollIntoView: (el: HTMLElement) => void;
}

export type FormEvents = { scroll: BaseField<unknown> };

export const CheersFormContext = React.createContext<CheersFormContextValue<FormEvents>>({
  form: new Form({}),
  emitter: mitt<FormEvents>(),
  scrollIntoView: (el) => el.scrollIntoView({ behavior: 'smooth' }),
});
