/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { hasOwnProperty } from "./Util";

export type Validator = (context:string, value:any) => void;
export function objectValidator(template:any):Validator {
    return (context, value) => {
        if (value === undefined || typeof(value) !== 'object') {
            throw `object expected at ${context}`
        }

        for(const key in template) {
            (template[key] as Validator)(context + "." + key, value[key]);            
        }

        for(const key in value) {
            if (!hasOwnProperty(template, key)) {
                throw `invalid property "${key}" in ${context}`
            }
        }
    }
}

export function enumValidator(options:any[]):Validator {
    return (context, value) => {
        if (!options.some(option => option === value)) {
            throw `invalid value "${value}" for ${context}`
        }
    }
}

export function lookupValidator(valueValidator:Validator):Validator {
    return (context, lookup) => {
        for(const key in lookup) {
            const value = lookup[key];
            valueValidator(context + "." + key, value);
        }
    }
}

export const stringValidator:Validator = (context, value) => {
    if (typeof(value) !== 'string') {
        throw `"${context}" should be a string`
    }
}
export const booleanValidator:Validator = (context, value) => {
    if (typeof(value) !== 'boolean') {
        throw `${context} should be true or false`
    }
}
export function optionalValidator(validator:Validator):Validator {
    return (context, value) => {
        if (value !== undefined) {
            validator(context, value);
        }
    }
}
export function arrayValidator(itemValidator:Validator):Validator {
    return (context, value) => {
        if (!Array.isArray(value)) {
            throw `${context} should be an array`
        }
        value.forEach((item,idx) => itemValidator(context + '[' + idx + ']', item));
    }
}

