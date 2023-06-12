/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
declare module 'decompress-unzip' {

    // Interface for files in decompress-unzip
    interface DecompressFile {
        data: Buffer;
        mode: number;
        mtime: string;
        path: string;
        type: string;
    }

    type Decompresser = (buffer:Buffer) => Promise<DecompressFile[]>;

    export default function decompress():Decompresser;
}
