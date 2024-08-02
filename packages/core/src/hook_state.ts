import { isUndefined } from 'lodash';
import { BaseField } from './field';

export type HookSource = {
  emitter: 'change' | 'validate' | 'reset' | 'required' | 'disabled' | 'ignore' | 'blur';
  field: BaseField<unknown>;
};
let currentSource: HookSource | undefined;
let currentField: BaseField<unknown> | undefined;
let uninstalls: (() => void)[] = [];

export function getSource(): HookSource | undefined {
  return currentSource;
}

export function setSource(s?: HookSource) {
  currentSource = s;
}

export function setCurrentField(field: BaseField<unknown> | undefined) {
  if (isUndefined(field)) {
    field = undefined;
    uninstalls = [];
  } else {
    currentField = field;
  }
}

export function getCurrentField() {
  return currentField;
}

export function pushUninstallHook(uninstall: () => void) {
  uninstalls.push(uninstall);
}

export function getUnstallHooks() {
  return uninstalls;
}
