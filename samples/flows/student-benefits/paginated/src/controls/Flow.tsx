/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAFlowItemGroup, IARecordListFlowItemGroup, IAFlowItem } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { ControlProps } from "./Control";
import { Page } from "./Page";

export function PageGroup({control}:ControlProps<IAFlowItemGroup>) {
	return <div key={control.id} class="group">
        {control.items.map(flowItemFactory)}
    </div>;
}

export function ListPageGroup({control}:ControlProps<IARecordListFlowItemGroup>) {
	return <div key={control.id} class="list-group">
        {control.items.map(group=><PageGroup control={group}/>)}
    </div>;
}

export function flowItemFactory(item: IAFlowItem) {
    if ("isVisible" in item && !item.isVisible)
        return null;
    switch (item.kind) {
    case "page":
        return <Page page={item}/>
    case "flowItemGroup":
        return <PageGroup control={item}/>
    case "recordListFlowItemGroup":
        return <ListPageGroup control={item}/>
    default:
        return <div>Unhandled flow item</div>
    }
}
