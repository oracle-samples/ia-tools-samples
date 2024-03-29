/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import {createDebugSession, createSession} from "@oracle/ia-flows-sdk";
import { IAFlowSession } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { render } from "preact";
import Application, { logger } from "./Application";
import {debug} from "util";

function setGlobalInputData(session: IAFlowSession, data: object) {
    if (session.globalInputDataDefinition) {
        // surface level validation
        for (const propName in data) {
            if (!session.globalInputDataDefinition.properties.hasOwnProperty(propName)) {
                logger.error(`Property "${propName}" in supplied global input data is not specified in this flow`);
            }
        }
        for (const propName in session.globalInputDataDefinition.properties) {
            if (propName === 'currentDate') {
                const today:Date = new Date();
                const toText = (v: number):string => {return v < 10 ? "0" + v : v + ""}
                const currentDate= [toText(today.getFullYear()), toText(today.getMonth() + 1), toText(today.getDate())].join("-");
                if (data) {
                    data['currentDate'] = currentDate;
                } else {
                    data = { currentDate };
                }
            } else {
                if (!data || !data.hasOwnProperty(propName)) {
                    logger.log(`Property "${propName}" defined in this flow was not given a value at session start`);
                }
            }
        }
        session.setGlobalInputData(data);
    }
}

export async function startSession() {
    const url = new URL(window.location.href);

    const jwt = url.searchParams.get("_iajwt");

    try {
        if (jwt == null) {
            throw new Error("JWT missing");
        }

        const debuggerEnabled = (url.searchParams.get("_debugger") ?? "false").toLowerCase() === 'true';

        let session;
        if(debuggerEnabled){
            session = await createDebugSession({
                jwt
            })
        } else {
            session = await createSession({
                jwt
            });
        }

        const globalInputBase64 = url.searchParams.get("_globalDataBase64");
        let globalInputData = null;
        if (globalInputBase64) {
            globalInputData = JSON.parse(atob(globalInputBase64));
        }
        setGlobalInputData(session, globalInputData);

        await session.refreshModel();

        document.getElementById('flow-container').replaceChildren();
        render(<Application session={session} jwt={jwt} debuggerEnabled={debuggerEnabled}/>, document.getElementById('flow-container'));

    } catch (ex) {
        document.getElementById('flow-container').replaceChildren();
        render(<div class="startup-error">{ex.message ?? ex}</div>, document.getElementById('flow-container'));
    }
}

startSession();