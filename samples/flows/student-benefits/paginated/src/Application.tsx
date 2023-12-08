/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import {IADebugFlowSession, IAFlowSession, IAPage, IASentDataObject} from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import {StateUpdater, useState} from "preact/hooks";
import {Page} from "./controls/Page";
import {Debugger} from "./Debugger";
import Navigation from "./Navigation";
import {findFirstControlWithErrors, getFirstVisiblePage, getVisibleInputControls} from "./PageUtils";
import {ApplicationSession, ApplicationState, generateNewState, SessionContext} from "./Session";

/** Logging functions overwritten in debug.tsx; there's no logging by default in production */
export const logger = {
    log: (msg, isError = false) => {
    }, error: (msg) => {
    }
};

/** There isn't a production implementation of 'transact', but when run in debug
 *  the transact function is overwritten by a debugTransaction function in DebugDataAdapter.ts */
export const dataAdapter = {
    transact: (schemeId: string, inputData: IASentDataObject, resultDefinition: any) => {
        return {}
    }
};

interface ApplicationProps {
    session: IAFlowSession;
    debuggerEnabled: boolean;
}

export default function Application({session, debuggerEnabled}: ApplicationProps) {

    const firstPage = getFirstVisiblePage(session.model.items);
    if (!firstPage) {
        logger.error('There were no visible pages to display');
        return <p>Sorry, there was an error</p>
    }

    const [appState, setAppState]: [ApplicationState, StateUpdater<ApplicationState>] = useState(generateNewState(session, firstPage, null));

    function updateAppState(newCurrentPage?: IAPage) {
        const currentPage = newCurrentPage ?? appState.currentPage;
        const newAppState = generateNewState(session, currentPage, appState);
        setAppState(newAppState);
    }

    const applicationSession: ApplicationSession = {
        async inputChanged(controlId: string) {
            if (!appState.attemptedInputIDs.includes(controlId)) {
                appState.attemptedInputIDs.push(controlId);
            }
            await session.refreshModel();
            updateAppState();
        },
        inputLostFocus(controlId: string) {
            if (!appState.attemptedInputIDs.includes(controlId)) {
                appState.attemptedInputIDs.push(controlId);
                updateAppState();
            }
        },
        moveToPreviousPage() {
            if (appState.previousPage !== null) {
                // it's ok to navigate backwards regardless of control errors
                updateAppState(appState.previousPage);
            }
        },
        moveToNextPage() {
            if (appState.nextPage !== null) {
                // mark all visible controls on the page as 'attempted'
                const newInputAttempts = getVisibleInputControls(appState.currentPage)
                    .filter(c => !appState.attemptedInputIDs.includes(c.id)).map(c => c.id);
                if (newInputAttempts.length > 0) {
                    appState.attemptedInputIDs.push(...newInputAttempts);
                    updateAppState();
                }

                // check there are no invalid or incomplete mandatory fields before navigating forwards
                const firstCtrlErr = findFirstControlWithErrors(appState.currentPage);
                if (firstCtrlErr && firstCtrlErr.kind === "input") {
                    document.getElementById(firstCtrlErr.id).focus();
                } else if (firstCtrlErr && firstCtrlErr.kind === "customDataAction") {

                    // How do you want to treat data action failures? This example does not render
                    // them on screen, but pops up this message if you try to continue to the next screen
                    alert("There was a data action failure, you can not continue");

                } else {
                    updateAppState(appState.nextPage);
                }
            }
        },
        moveToPage(page: IAPage) {
            if (appState.visitedPageIDs.includes(page.id)) {
                // it's ok to navigate to previously visited screens regardless of control errors
                updateAppState(page);
            }
        },
        getState() {
            return appState;
        }
    }

    return <SessionContext.Provider value={applicationSession}>
        <div class="main">
            <div class="flow">
                <Navigation/>
                <main>
                    <Page page={appState.currentPage}/>
                </main>
            </div>
            {debuggerEnabled ? <Debugger debugSession={session as IADebugFlowSession}/> : null}
        </div>
    </SessionContext.Provider>
}