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

    return <div role="group" key={control.id} class="record-collect size-12" aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0} onfocusout={() => session.inputLostFocus(control.id)}>
        <h2 dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}} />
        {control.containers.map(container=>{
            return <div key={container.id} class="record-instance">
                {container.rows.map(row=>(<Row row={row}/>))}
                <button onClick={async ()=>{
                    control.removeRecord(container.recordReference);
                    session.inputChanged(control.id);
                }}>{localize("Remove record", [], false)}</button>
            </div>
        })}
        <button onClick={async ()=>{
            control.addNewRecord();
            session.inputChanged(control.id);
        }}>{localize("Add record", [], false)}</button>
        <Error control={control} />
    </div>
}
