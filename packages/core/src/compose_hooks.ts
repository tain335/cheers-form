import { Effect } from './effect';
import { BaseField, PendingEffect } from './field';
import { FieldState } from './field_state';
import { Hook } from './hook_chain';
import { getCurrentField, pushUninstallHook } from './hook_state';

export function onChanged<T>(hook: Hook<T>) {
  const field = getCurrentField();
  const uninstall = field?.$hookChain.hook('changed', hook as Hook<any>);
  if (uninstall) {
    pushUninstallHook(uninstall);
  }
}

export function onUpdateSelfState<T>(hook: Hook<FieldState<T>>) {
  const field = getCurrentField();
  const uninstall = field?.$hookChain.hook('updateSelfState', hook as Hook<any>);
  if (uninstall) {
    pushUninstallHook(uninstall);
  }
}

export function onSubmitEffects<T>(hook: Hook<PendingEffect<BaseField<T>>[]>) {
  const field = getCurrentField();
  const uninstall = field?.$hookChain.hook('submitEffects', hook as Hook<any>);
  if (uninstall) {
    pushUninstallHook(uninstall);
  }
}

export function onBeforeExecuteEffect<T>(hook: Hook<Effect<BaseField<T>>>) {
  const field = getCurrentField();
  const uninstall = field?.$hookChain.hook('beforeExecuteEffect', hook as Hook<any>);
  if (uninstall) {
    pushUninstallHook(uninstall);
  }
}

export function onAfterExecuteEffect<T>(hook: Hook<Effect<BaseField<T>>>) {
  const field = getCurrentField();
  const uninstall = field?.$hookChain.hook('afterExecuteEffect', hook as Hook<any>);
  if (uninstall) {
    pushUninstallHook(uninstall);
  }
}

export function onUninstall<T>(hook: Hook<FieldState<T>>) {
  const field = getCurrentField();
  const uninstall = field?.$hookChain.hook('uninstall', hook as Hook<any>);
  if (uninstall) {
    pushUninstallHook(uninstall);
  }
}

export function onUpdated<T>(hook: Hook<FieldState<T>>) {
  const field = getCurrentField();
  const uninstall = field?.$hookChain.hook('updated', hook as Hook<any>);
  if (uninstall) {
    pushUninstallHook(uninstall);
  }
}
