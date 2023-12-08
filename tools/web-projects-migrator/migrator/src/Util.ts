/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */

/** A typed definition of a string=>something dictionary type */
export type Lookup<T> = { [name:string]:T };

/** Case-insensitive map where the keys are strings */
export class NCMap<T> {
    lookup:Lookup<T> = {};

    constructor(values?:T[], keyFn?:(value:T, idx:number) => string) {
        if (values !== undefined) {
            // Quick lookup creation from an array
            values.forEach((v,i) => this.set(keyFn(v,i), v));
        }
    }

    get(key:string):T {
        return this.lookup[StringUtil.nc(key)];
    }

    set(key:string, value:T) {
        this.lookup[StringUtil.nc(key)] = value;
    }
}

/** Case-insensitive set of strings */
export class NCSet {
    values:string[] = [];
    seenValues = new Set<string>();

    constructor() { }

    /** returns true if the value was added, or false if it was already there */
    add(value:string) {
        const ncValue = StringUtil.nc(value);
        if (this.seenValues.has(ncValue)) {
            return false;
        }
        this.seenValues.add(ncValue);
        this.values.push(value);
        return true;
    }

    has(value:string) {
        const ncValue = StringUtil.nc(value);
        return this.seenValues.has(ncValue);
    }
}

/** Shorthand for Set.add() that returns false if the item already existed in the set */
export function addToSet<T>(set:Set<T>, item:T):boolean {
    if (set.has(item)) {
        return false;
    }
    set.add(item);
    return true;
}

export function hasOwnProperty(object:any, property:string) {
    return Object.prototype.hasOwnProperty.call(object, property);
}

export class StringUtil {
    /**
     * nc ("no case") transformations are for case-insensitive string comparisons.
     * The unicode spec defines a proper "case-folding" method for this (which Oracle Intelligent Advisor uses internally),
     * but for the purposes of this sample we just use "toUpperCase".
     */
    public static nc(str:string) {
        return str.toUpperCase();
    }

    public static equalsNC(str1:string, str2:string) {
        return StringUtil.nc(str1) === StringUtil.nc(str2);
    }

    public static endsWithNC(str:string, suffix:string):boolean {
        const ncStr = StringUtil.nc(str), ncSuffix = StringUtil.nc(suffix);
        return ncStr.endsWith(ncSuffix);
    }

    public static containsNC(str:string, search:string):boolean {
        const ncStr = StringUtil.nc(str), ncSearch = StringUtil.nc(search);
        return ncStr.indexOf(ncSearch) >= 0;
    }

    public static isLetterOrDigit(ch:string) {
        // Fancy-pants unicode regex to include letters that aren't just A-Z
        return /[\p{L}0-9]/u.test(ch);
    }

    public static isAllWhitespace(str:string) {
        return str.trim().length === 0;
    }
}

export function newUID() {
    return Math.random().toString(36).substring(2);
}
