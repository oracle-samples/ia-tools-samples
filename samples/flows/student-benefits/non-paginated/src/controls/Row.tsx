/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAControl, IARow } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { localize } from "../Localizer";
import { handleDataTransaction } from "./DataAction";
import { Group, ListGroup } from "./Group";
import { inputFactory } from "./InputControls";
import { MultiSelect } from "./MultiSelect";
import { RecordCollect } from "./RecordCollect";
import { Validation } from "./Validation";

function controlFactory(item: IAControl) {
    if (!item.isVisible)
        return null;
    switch (item.kind) {
    case "label":
        return <div class={`label size-${item.layoutWidth}`} dangerouslySetInnerHTML={{__html: localize(item.htmlTranslationKey, item.translationParameters, true)}}></div>;
    case "input":
        return inputFactory(item);
    case "referenceList":
        return <MultiSelect control={item}/>
    case "recordCollect":
        return <RecordCollect control={item}/>
    case "group":
        return <Group control={item}/>
    case "recordList":
        return <ListGroup control={item}/>
    case "validation":
        return <Validation control={item}/>
    case "customDataAction":
        handleDataTransaction(item);
        return null;
    }
}

interface RowProps {
    row: IARow;
}

export function Row({row}: RowProps) {
    if (!row.isVisible)
        return null;
    return <div key={row.id} class="row">{row.controls.map(controlFactory)}</div>
}
