import React from 'react';
import { FieldGroup } from 'cheers-form/core';

export const CheersFieldGroupContext = React.createContext<FieldGroup<Record<string, any>>>(new FieldGroup({}));
