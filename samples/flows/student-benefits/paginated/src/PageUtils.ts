/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAControl, IAFlowItem, IAFlowItemGroup, IAFlowSession, IAInputControl, IAPage, IARecordListFlowItemGroup, IARow } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";

export function getFirstVisiblePage(items: IAFlowItem[]) {
    let firstVisiblePage: IAPage = null;
    for (const item of items) {
        switch (item.kind) {
            case "page":
                const page = item as IAPage;
                if (page.isVisible) {
                    firstVisiblePage = page;
                    break;
                }
                continue;
            case "flowItemGroup":
                const itemGroup = item as IAFlowItemGroup;
                firstVisiblePage = getFirstVisiblePage(itemGroup.items);
                break;
            case "recordListFlowItemGroup":
                const recordListGroup = item as IARecordListFlowItemGroup;
                firstVisiblePage = getFirstVisiblePage(recordListGroup.items);
                break;
        }
        if (firstVisiblePage !== null) {
            return firstVisiblePage;
        }
    }
    return null;
}

export function getAllPages(session: IAFlowSession, visibleOnly = true) {
    const allPages: IAPage[] = [];
    for (const item of session.model.items) {
        _populatePages(item, allPages, visibleOnly);
    }
    return allPages;
}

export function getChildPages(item: IAFlowItem, visibleOnly = true): IAPage[] {
    const pages: IAPage[] = [];
    _populatePages(item, pages, visibleOnly);
    return pages;
}

function _populatePages(item: IAFlowItem, pages: IAFlowItem[], visibleOnly: boolean) {
    if (visibleOnly && "isVisible" in item && !item.isVisible)
        return;
    switch (item.kind) {
    case "page":
        pages.push(item);
        return;
    case "flowItemGroup":
        const itemGroup = item as IAFlowItemGroup;
        itemGroup.items.forEach(i => _populatePages(i, pages, visibleOnly));
        return;
    case "recordListFlowItemGroup":
        const recordListGroup = item as IARecordListFlowItemGroup;
        recordListGroup.items.forEach(i => _populatePages(i, pages, visibleOnly));
        return;
    }
}

/** Find the page/group item amongst the given top level items, then return an array
 * representing the hierarchy from root => item, if found */
export function getItemHierarchy(item: IAFlowItem, itemCollection: IAFlowItem[]): IAFlowItem[] {
    let hierarchy;
    for (const i of itemCollection) {
        if (i === item) {
            return [i];
        }
        switch (i.kind) {
        case "page":
            continue;
        case "flowItemGroup":
            const itemGroup = i as IAFlowItemGroup;
            hierarchy = getItemHierarchy(item, itemGroup.items);
            break;
        case "recordListFlowItemGroup":
            const recordListGroup = i as IARecordListFlowItemGroup;
            hierarchy = getItemHierarchy(item, recordListGroup.items);
            break;
        }

        if (hierarchy) {
            return [i, ...hierarchy];
        }
    }
    return null;
}

export function findFirstControlWithErrors(page: IAPage): IAControl {
    for (const row of page.rows) {
        const invalidInput = row.controls.find(c => c.isVisible && (c as IAInputControl<any>).errors?.length > 0);
        if (invalidInput) {
            return invalidInput;
        }
    }
    return null;
}

export function getVisibleInputControls(page: IAPage): IAControl[] {
    const ctrls = [];
    page.rows.forEach(r => {
        if (r.isVisible) {
            ctrls.push(...r.controls.filter(c => c.isVisible && c.kind === "input"));
        }
    });
    return ctrls;
}