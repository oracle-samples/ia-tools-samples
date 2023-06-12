/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAValidationControl } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { localize } from "../Localizer";
import { ControlProps } from "./Control";

export function Validation({control}: ControlProps<IAValidationControl>) {
    return <div key={control.id} class="alert" dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}} />
}

