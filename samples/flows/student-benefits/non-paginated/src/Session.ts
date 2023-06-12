/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { createContext } from "preact";

export const SessionContext = createContext(null);

export interface ApplicationSession {
    refresh();
    loadSession(storedSessionState: string): Promise<void>;
    getSessionState(excludeDataActions: boolean): string;
}
