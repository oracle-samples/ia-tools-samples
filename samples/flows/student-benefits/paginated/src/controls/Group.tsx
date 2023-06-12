/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAGroupControl, IARecordListControl } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { ControlProps } from "./Control";
import { Row } from "./Row";

export function ListGroup({control}: ControlProps<IARecordListControl>) {
    return <div key={control.id}>
        {control.containers.map(container=>{
            return <div key={container.id}>
                {container.rows.map(row=>(<Row row={row}/>))}
            </div>
        })}
    </div>;
}

export function Group({control}: ControlProps<IAGroupControl>) {
    return <div key={control.id}>
        {control.rows.map(row=>(<Row row={row}/>))}
    </div>;
}
