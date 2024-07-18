import { ChangeEvent } from 'react';
import { BaseField } from 'cheers-form-core';

function isSyntheticEvent(event: any): event is React.SyntheticEvent {
  return event && typeof event === 'object' && 'nativeEvent' in event;
}

type FormElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function getEventValue(event: ChangeEvent<FormElement>): string | boolean | FileList | null {
  const target = event.target;

  if (target instanceof HTMLInputElement) {
    if (target.type === 'checkbox' || target.type === 'radio') {
      return target.checked;
    }
    if (target.type === 'file') {
      return target.files;
    }
    return target.value;
  }
  if (target instanceof HTMLTextAreaElement) {
    return target.value;
  }
  if (target instanceof HTMLSelectElement) {
    return target.value;
  }

  return null;
}

export function bindField(field: BaseField<unknown>) {
  return {
    onChange: (event: any) => {
      if (isSyntheticEvent(event)) {
        field.$onChange(getEventValue(event as ChangeEvent<FormElement>));
      } else {
        field.$onChange(event);
      }
    },
    onBlur: field.$onBlur.bind(field),
    value: field.$raw,
  };
}
