/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAFlowItemGroup, IAFlowSession, IAPage } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { createContext } from "preact";
import { getAllPages } from "./PageUtils";

export const SessionContext = createContext<ApplicationSession>(null);

export interface ApplicationSession {
    // observe control events
    inputChanged(controlId: string);
    inputLostFocus(controlId: string);

    // page actions
    moveToPreviousPage();
    moveToNextPage();
    moveToPage(page: IAPage);

    // get state object
    getState(): ApplicationState;
}

export interface ApplicationState {
    currentModel: IAFlowItemGroup;
    currentPage: IAPage;
    previousPage: IAPage;
    nextPage: IAPage;
    visiblePages: IAPage[];
    visitedPageIDs: string[];
    attemptedInputIDs: string[];
}

export function generateNewState(session: IAFlowSession, newCurrentPage: IAPage, previousState?: ApplicationState): ApplicationState {
    const attemptedInputIDs = previousState?.attemptedInputIDs ?? [];
    const visitedPageIDs = previousState?.visitedPageIDs ?? [];
    if (!visitedPageIDs.includes(newCurrentPage.id)) {
        visitedPageIDs.push(newCurrentPage.id);
    }

    const currentPageId = newCurrentPage.id;
    const allPages = getAllPages(session, false);
    const currentPage = allPages.find(p => p.id === currentPageId);

    const visiblePages = getAllPages(session, true);
    let previousPage = null;
    let nextPage = null;
    for (let i = 0; i < visiblePages.length; ++i) {
        const p = visiblePages[i];
        if (p.id === currentPage.id) {
            previousPage = (i === 0 ? null : visiblePages[i - 1]);
            nextPage = (i === visiblePages.length - 1 ? null : visiblePages[i + 1]);
            break;
        }
    }

    return {
        currentModel: session.model,
        currentPage: currentPage,
        previousPage: previousPage,
        nextPage: nextPage,
        visiblePages: visiblePages,
        visitedPageIDs: visitedPageIDs,
        attemptedInputIDs: attemptedInputIDs
    };
}