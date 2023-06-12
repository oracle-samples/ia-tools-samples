/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IARecordCollectControl } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { useContext } from "preact/hooks";
import { localize } from "../Localizer";
import { ApplicationSession, SessionContext } from "../Session";
import { ControlProps } from "./Control";
import { Error } from "./InputControls";
import { Row } from "./Row";

export function RecordCollect({control}: ControlProps<IARecordCollectControl>) {
    const session: ApplicationSession = useContext(SessionContext);
    var isRequiredStyling="display: none;"
    if(control.isRequired){isRequiredStyling="display: inline-block;color:red;"}
    return <div role="group" key={control.id} class="record-collect size-12" aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0}>
        <h2 style="display: inline-block;"dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}} />
        <h2 style={isRequiredStyling} >*</h2>
         <br></br>
        {control.containers.map(container=>{
            return <div key={container.id} class="record-instance">
                {container.rows.map(row=>(<Row row={row}/>))}
                <button onClick={async ()=>{
                    control.removeRecord(container.recordReference);
                    session.refresh();
                }}>{localize("Remove record", [], false)}</button>
            </div>
        })}
        <button onClick={async ()=>{
            control.addNewRecord();
            session.refresh();
        }}>{localize("Add record", [], false)}</button>
        <Error control={control} />
    </div>
}
