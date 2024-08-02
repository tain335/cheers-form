import {
  onAfterExecuteEffect,
  onBeforeExecuteEffect,
  onSubmitEffects,
  onUpdateSelfState,
  onUpdated,
} from './compose_hooks';
import { Field } from './field';
import { FieldState } from './field_state';
import { Form } from './form';
import { Validator } from './validator';

type NameFormModel = {
  name: string;
};

test('[compose_hook] onUpdated hook', (done) => {
  const form = new Form<NameFormModel>({
    name: new Field('', {
      composeHooks: [
        () => {
          onUpdated((state, next) => {
            expect(state.$raw).toBe('test');
            done();
            next(state);
          });
        },
      ],
    }),
  });
  form.name.$onChange('test');
});

test('[compose_hook] onSubmitEffects hook', (done) => {
  const form = new Form<NameFormModel>({
    name: new Field('', {
      validators: [
        new Validator({
          async validate(field, updateState) {},
        }),
      ],
      composeHooks: [
        () => {
          onSubmitEffects((effects, next) => {
            expect(effects.length).toBe(1);
            done();
            next(effects);
          });
        },
      ],
    }),
  });
  form.name.$onChange('test');
});

test('[compose_hook] onUpdateSelfState hook', (done) => {
  let first = true;
  const form = new Form<NameFormModel>({
    name: new Field('', {
      validators: [
        new Validator({
          async validate(field, updateState) {},
        }),
      ],
      composeHooks: [
        () => {
          onUpdateSelfState((state, next) => {
            if (first) {
              expect(state.$raw).toBe('test');
              state.$raw = 'test2';
              first = false;
            } else {
              expect(state.$raw).toBe('test2');
            }
            next(state);
          });
        },
      ],
    }),
  });
  form.name.$onChange('test');
  expect(form.name.$raw).toBe('test2');
  done();
});

test('[compose_hook] onBeforeExecuteEffect hook', (done) => {
  const form = new Form<NameFormModel>({
    name: new Field('', {
      validators: [
        new Validator({
          async validate(field, updateState) {},
        }),
      ],
      composeHooks: [
        () => {
          onBeforeExecuteEffect(() => {
            done();
          });
        },
      ],
    }),
  });
  form.name.$onChange('test');
});

test('[compose_hook] onAfterExecuteEffect hook', (done) => {
  const form = new Form<NameFormModel>({
    name: new Field('', {
      validators: [
        new Validator({
          async validate(field, updateState) {},
        }),
      ],
      composeHooks: [
        () => {
          onAfterExecuteEffect(() => {
            done();
          });
        },
      ],
    }),
  });
  form.name.$onChange('test');
});
