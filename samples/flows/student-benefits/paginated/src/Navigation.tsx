/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAFlowItem, IAFlowItemGroup, IAPage } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { useContext } from "preact/hooks";
import { getChildPages, getItemHierarchy } from "./PageUtils";
import { ApplicationSession, SessionContext } from "./Session"

export default function Navigation() {
    const session: ApplicationSession = useContext(SessionContext);
    const appState = session.getState();
    const currentPage = appState.currentPage;
    const currentNavigationItem = getItemHierarchy(currentPage, appState.currentModel.items)[0];

    function buildNavigationItem(item: IAFlowItem) {
        const text = getItemName(item);
        if (!text) {
            /* Assume an unnamed group or page shouldn't be in the navigation,
             * and that an empty space shouldn't be clickable */
            return null;
        }

        let className;
        let pageIfClicked: IAPage;
        let onClick: () => void;
        if (item === currentNavigationItem) {
            className = "nav-current-item";

        } else if (pageIfClicked = getChildPages(item, true).find(p => appState.visitedPageIDs.includes(p.id))) {
            className = "nav-visitable-item";
            onClick = () => session.moveToPage(pageIfClicked);
        }

        return <li onClick={onClick}><div class={className}>{text}</div></li>
    }

    function buildPageSelect() {
        if (currentNavigationItem.kind === "flowItemGroup") {
            const group = currentNavigationItem as IAFlowItemGroup;
            const visitedPages: IAPage[] = group.items.filter(i => appState.visitedPageIDs.includes(i.id)) as IAPage[];
            if (visitedPages.length > 1) {
                // allow selection of page within the group
                // NOTE: Groups within groups not supported by this example code
                return <select class="page-select" onChange={(evt)=>session.moveToPage(visitedPages.find(p => p.id === (evt.srcElement as HTMLSelectElement).value))} value={currentPage.id}>
                    {visitedPages.map(i => <option value={(i as IAPage).id}>{(i as IAPage).text}</option>)}
                </select>
            }
        }
        return null;
    }

    return <>
        <nav>
            <ol>
                {appState.currentModel.items.map(item => buildNavigationItem(item))}
            </ol>
        </nav>
        {buildPageSelect()}
    </>
}


function getItemName(item: IAFlowItem) {
    if ("isVisible" in item && !item.isVisible) {
        return null;
    }
    switch (item.kind) {
        case "page":
        case "flowItemGroup":
            return item.text;
        default:
            return null;
    }
}