/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */

// Maps A-Z to 1-26 and AA to 27, etc
export function colRefToNumber(colRef:string):number {
    let result = 0; // A-Z will be 1-26, we adjust at the end
    for(let i=0; i<colRef.length; i++) {
        const ch = colRef.charCodeAt(i);
        if (ch < 65 || ch > 90) throw "bad column ref";
        result = result * 26 + (ch-64);
    }
    return result;
}

// maps 1-26 to A-Z and 27 to AA, etc
export function numberToColRef(col:number):string {
    let ret="", remainder=col-1;
    for(;;) {
        ret = String.fromCharCode(65 + (remainder % 26)) + ret;
        if (remainder < 26) {
            return ret;
        }
        remainder = (remainder / 26 | 0) - 1;
    }
}

export function parseCellRef(ref:string) {
    let numPos = 0;
    while(/[A-Z]/.test(ref.charAt(numPos))) numPos++;
    let endPos = numPos;
    while(/[0-9]/.test(ref.charAt(endPos))) endPos++;
    if (endPos != ref.length) throw "bad cell ref " + ref;
    return { col:colRefToNumber(ref.substring(0,numPos)), row:parseInt(ref.substring(numPos)) };
}

export function toCellRef(col:number, row:number) {
    return numberToColRef(col) + row;
}

export function parseCellRange(range:string) {
    const startAndEnd = range.split(':');
    if (startAndEnd.length != 2) throw "bad cell range " + range;
    return {
        start:parseCellRef(startAndEnd[0]),
        end:parseCellRef(startAndEnd[1])
    }
}
