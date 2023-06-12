/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAInputValue, IAInputControl, IARecordRef, IAReferenceListInputControl, IAErrorInfo } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { JSX } from "preact";
import { useContext, useEffect, useRef } from "preact/hooks";
import { localize } from "../Localizer";
import { ApplicationSession, SessionContext } from "../Session";


interface ErrorProps {
    control: {
        id: string;
        errors: IAErrorInfo[];
    }
}

export function Error({ control }: ErrorProps) {
    const session: ApplicationSession = useContext(SessionContext);

    return <>{session.getState().attemptedInputIDs.includes(control.id) ? <div id={"err-" + control.id}>
        {control.errors.map(e => {
            const htmlEscapedKey = e.messageTranslationKey.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return <div class="error-label" dangerouslySetInnerHTML={{__html: localize(htmlEscapedKey, e.translationParameters, true)}} />
        })}
    </div> : null}</>
}


interface InputFieldProps<T extends IAInputValue> {
    control: IAInputControl<T>;
}

export function TextField({ control }: InputFieldProps<string | number>) {
    const session: ApplicationSession = useContext(SessionContext);

    return <div key={control.id} class={`text-field size-${control.layoutWidth}`}>
        <label for={control.id} dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
        <input id={control.id} disabled={control.isReadOnly} type="text" value={control.textValue} onInput={({ currentTarget }: JSX.TargetedEvent<HTMLInputElement, Event>) => {
            control.textValue = currentTarget.value;
            session.inputChanged(control.id);
        }} onfocusout={() => session.inputLostFocus(control.id)} aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0} />
        <Error control={control} />
    </div>
}

export function TextAreaField({ control }: InputFieldProps<string>) {
    const session: ApplicationSession = useContext(SessionContext);

    const resizeToFit = () => {
        const textarea = document.getElementById(control.id);
        textarea.style.height = "";
        textarea.style.height = textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight + "px";
    }

    // resize if control's value is changed elsewhere
    useEffect(() => resizeToFit(), [control.textValue]);

    return <div key={control.id} class={`textarea-field size-${control.layoutWidth}`}>
        <label for={control.id} dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
        <textarea id={control.id} disabled={control.isReadOnly} value={control.textValue} onInput={({ currentTarget }: JSX.TargetedEvent<HTMLTextAreaElement, Event>) => {
            resizeToFit(); // resize before scrollbar is visible
            control.textValue = currentTarget.value;
            session.inputChanged(control.id);
        }} onfocusout={() => session.inputLostFocus(control.id)} aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0} />
        <Error control={control} />
    </div>
}

export function BooleanCheckbox({ control }: InputFieldProps<boolean>) {
    const session: ApplicationSession = useContext(SessionContext);

    return <div key={control.id} class={`checkbox-field size-${control.layoutWidth}`}>
        <input id={control.id} type="checkbox" disabled={control.isReadOnly} checked={control.value} onInput={({ currentTarget }: JSX.TargetedEvent<HTMLInputElement, Event>) => {
            control.value = currentTarget.checked;
            session.inputChanged(control.id);
        }} onfocusout={() => session.inputLostFocus(control.id)} aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0} />
        <label for={control.id} dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
        <Error control={control} />
    </div>
}

export function BooleanRadio({ control }: InputFieldProps<boolean>) {
    const session: ApplicationSession = useContext(SessionContext);

    return <div class={`radio-field size-${control.layoutWidth}`}>
        <fieldset role="radiogroup" aria-labelledby={"lbl-" + control.id} aria-describedby={"err-" + control.id}
                aria-invalid={control.errors.length > 0} key={control.id} onfocusout={() => session.inputLostFocus(control.id)}>
            <legend id={"lbl-" + control.id} dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
            {control.options.map(opt => (<label class="radio-option"><input role="radio" type="radio" name={control.id} disabled={control.isReadOnly} checked={control.value == opt.value} onInput={evt => {
                control.value = opt.value;
                session.inputChanged(control.id);
            }} /> {localize(opt.textTranslationKey, opt.translationParameters, false)}</label>))}
            <Error control={control} />
        </fieldset>
    </div>;
}

export function RecordRefRadio({ control }: InputFieldProps<IARecordRef>) {
    const session: ApplicationSession = useContext(SessionContext);

    return <div class={`radio-field size-${control.layoutWidth}`}>
        <fieldset role="radiogroup" aria-labelledby={"lbl-" + control.id} aria-describedby={"err-" + control.id} key={control.id} onfocusout={() => session.inputLostFocus(control.id)}>
            <legend id={"lbl-" + control.id} dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
            {control.options.map(opt => (<label class="radio-option"><input role="radio" type="radio" name={control.id} disabled={control.isReadOnly} checked={opt.value.equals(control.value)} onInput={evt => {
                control.value = opt.value;
                session.inputChanged(control.id);
            }} /> {localize(opt.textTranslationKey, opt.translationParameters, false)}</label>))}
            <Error control={control} />
        </fieldset>
    </div>
}

export function RecordRefSelect({ control }: InputFieldProps<IARecordRef>) {
    const session: ApplicationSession = useContext(SessionContext);
    const selectRef = useRef<HTMLSelectElement>(null);

    useEffect(() => {
        selectRef.current.selectedIndex = control.options.findIndex(opt => opt.value.equals(control.value));
    });

    return <div key={control.id} class={`select-field size-${control.layoutWidth}`}>
        <label for={control.id} dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
        <select id={control.id} ref={selectRef} disabled={control.isReadOnly} onfocusout={() => session.inputLostFocus(control.id)} onInput={({ currentTarget }: JSX.TargetedEvent<HTMLSelectElement, Event>) => {
            control.value = control.options[currentTarget.value]?.value;
            session.inputChanged(control.id);
        }} aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0}>
            {control.options.map((opt, idx) => <option value={idx}>{opt.text}</option>)}
        </select>
        <Error control={control} />
    </div>
}

export function inputFactory(item: IAInputControl<any>) {
    switch (item.schemeId) {
        case "text":
        case "date-general":
        case "number-general":
        case "number-currency":
            return <TextField control={item} />;
        case "text-area":
            return <TextAreaField control={item} />;
        case "boolean-checkbox":
            return <BooleanCheckbox control={item} />;
        case "boolean-radio":
            return <BooleanRadio control={item} />;
        case "reference-radio":
        case "radio":
            return <RecordRefRadio control={item} />;
        case "reference-dropdown":
        case "dropdown":
            return <RecordRefSelect control={item} />;
    }
    return <div>{item.schemeId}</div>
}
