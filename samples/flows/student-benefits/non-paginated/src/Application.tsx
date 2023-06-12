/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAFlowSession, IASentDataObject } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { useState } from "preact/hooks";
import { createSession } from "@oracle/ia-flows-sdk";
import { flowItemFactory } from "./controls/Flow";
import { SessionManager } from "./controls/SessionManager";
import { SessionContext } from "./Session";

/** Logging functions overwritten in debug.tsx: there's no logging in production */
export const logger = {log: (msg, isError = false) => {}, error: (msg) => {}};

/** There isn't a production implementation of 'transact', but when run in debug mode
 *  the transact function is overwritten by a debugTransaction function in DebugDataAdapter.ts */
export const dataAdapter = {
    transact: (schemeId: string, inputData: IASentDataObject, resultDefinition: any) => { return {} }
};

interface ApplicationProps {
    session: IAFlowSession;
    jwt: string;
}

export default function Application({ session, jwt }: ApplicationProps) {
    const [count, setCount] = useState(0);
    const [currentSession, setCurrentSession] = useState(session);

    const applicationSession = {
        async refresh() {
            await currentSession.refreshModel();
            setCount(count + 1);
        },

        async loadSession(storedSessionState: string): Promise<void> {
            const newSession = await createSession({jwt, resumeMode:"latestVersion", storedSessionState});
            setCurrentSession(newSession);
        },

        getSessionState(excludeDataActions: boolean): string {
            return currentSession.getSessionState({excludeDataActions});
        }
    }

    return <SessionContext.Provider value={applicationSession}>
        <div role="main">
            <SessionManager excludeDataActions={false} />
            {currentSession.model.items.map(item => flowItemFactory(item))}
        </div>
    </SessionContext.Provider>
}