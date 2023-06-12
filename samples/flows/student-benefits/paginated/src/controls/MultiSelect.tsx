/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAReferenceListInputControl } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { JSX } from "preact";
import { useContext } from "preact/hooks";
import { localize } from "../Localizer";
import { ApplicationSession, SessionContext } from "../Session";
import { Error } from "./InputControls";

interface MultiSelectProps {
    control: IAReferenceListInputControl;
}

export function MultiSelect({ control }: MultiSelectProps) {
    const session: ApplicationSession = useContext(SessionContext);

    return <div class={`checkset-field size-${control.layoutWidth}`}>
        <fieldset role="group" key={control.id} aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0} onfocusout={() => session.inputLostFocus(control.id)}>
            <legend for={control.id} dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
            {control.options.map(opt => (<label class="checkset-option">
                <input role="checkbox" type="checkbox" disabled={control.isReadOnly} checked={control.isSelected(opt.value)} onInput={({ currentTarget }: JSX.TargetedEvent<HTMLInputElement, Event>) => {
                    if (currentTarget.checked && !control.isSelected(opt.value)) {
                        control.value = control.value.concat(opt.value);
                        session.inputChanged(control.id);
                    } else if (!currentTarget.checked && control.isSelected(opt.value)) {
                        control.value = control.value.filter(v => !v.equals(opt.value));
                        session.inputChanged(control.id);
                    }
                }} /> {localize(opt.textTranslationKey, opt.translationParameters, false)}</label>))}
        </fieldset>
        <Error control={control} />
    </div>
}
