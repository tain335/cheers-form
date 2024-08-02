import { isFunction, remove } from 'lodash';
import { HookSource, getSource, setSource } from './hook_state';

export type Hook<Arg> = (arg: Arg, next: (arg: Arg) => void, source?: HookSource) => void;

export class HookChain<T> {
  private hooksMap = new Map<keyof T, Hook<T[keyof T]>[]>();

  source(s?: HookSource) {
    if (s) {
      setSource(s);
    } else {
      setSource(getSource());
    }
    return this;
  }

  hook(h: keyof T, hook: Hook<T[keyof T]>) {
    const hooks = this.hooksMap.get(h);
    if (!hooks) {
      this.hooksMap.set(h, [hook]);
    } else {
      hooks.push(hook);
      this.hooksMap.set(h, hooks);
    }
    return () => {
      const hooks = this.hooksMap.get(h);
      if (hooks) {
        remove(hooks, (item) => item === hook);
        this.hooksMap.set(h, hooks);
      }
    };
  }

  call<K extends keyof T>(h: K): void;

  call<K extends keyof T>(h: K, action: (a: T[K]) => void): void;

  call<K extends keyof T>(h: K, arg: T[K], action: (a: T[K]) => void): void;

  call<K extends keyof T>(h: K, arg?: T[K] | ((a: T[K]) => void), action?: (a: T[K]) => void): void {
    if (isFunction(arg)) {
      action = arg;
      arg = undefined;
    }

    const [continued, nextArg] = this.emit(h, arg as T[K]);
    if (continued === false) {
      return;
    }
    action?.(nextArg);
  }

  private emit<K extends keyof T>(h: K, arg: T[K]): [boolean, T[K]] {
    const hooks = this.hooksMap.get(h);
    if (!hooks) {
      return [true, arg];
    }
    const source = getSource();
    let current = 0;
    let completed = false;
    let nextArg: T[K] = arg;
    const createNext = () => {
      let called = false;
      return (a: T[K]) => {
        nextArg = a;
        if (called) {
          throw new Error('Cannot call next more than one time');
        }
        called = true;
        if (current < hooks.length) {
          hooks[current++](nextArg, createNext() as (arg: T[keyof T]) => void, source);
        }
        if (current >= hooks.length) {
          completed = true;
        }
      };
    };
    createNext()(arg);
    return [completed, nextArg];
  }
}
