/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAInputValue, IAInputControl, IARecordRef, IAErrorInfo } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
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
    return <div id={"err-" + control.id}>
        {control.errors.map(e => <div class="error-label" dangerouslySetInnerHTML={{__html: localize(e.messageTranslationKey, e.translationParameters, true)}} />)}
    </div>
}


interface InputFieldProps<T extends IAInputValue> {
    control: IAInputControl<T>;
}

export function TextFields({ control }: InputFieldProps<string | number>) {
    const session: ApplicationSession = useContext(SessionContext);
    var isRequiredStyling="display: none;"
    if(control.isRequired){isRequiredStyling="display: inline-block;color:red;"}
    if((control.inputStyle) === "textBox"){
         return <div key={control.id} class={`text-field size-${control.layoutWidth}`}>
                <label style="display: inline-block;" for={control.id} dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
                <label style={isRequiredStyling} >*</label>
                <input id={control.id} disabled={control.isReadOnly} type="text" value={control.textValue} onInput={({ currentTarget }: JSX.TargetedEvent<HTMLInputElement, Event>) => {
                    control.textValue = currentTarget.value;
                    session.refresh();
                }} aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0} />
                <Error control={control} />
            </div>
    }else if ((control.inputStyle) === "textArea") {
        const resizeToFit = () => {
            const textarea = document.getElementById(control.id);
            textarea.style.height = "";
            textarea.style.height = textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight + "px";
        }
        // resize if control's value is changed elsewhere
        useEffect(() => resizeToFit(), [control.textValue]);

        return <div key={control.id} class={`text-field size-${control.layoutWidth}`}>
            <label for={control.id}  style="display: inline-block;" dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
            <label style={isRequiredStyling} >*</label>
            <textarea id={control.id} style="display: block;" disabled={control.isReadOnly} value={control.textValue} onInput={({ currentTarget }: JSX.TargetedEvent<HTMLTextAreaElement, Event>) => {
            resizeToFit(); // resize before scrollbar is visible
            control.textValue = currentTarget.value;
            session.refresh();
        }} aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0} />
        <Error control={control} />
        </div>
    } else {
        //custom control code
        return <div key={control.id} class={`text-field size-${control.layoutWidth}`}>
                        <label for={control.id}  style="display: inline-block;color:grey;" dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
                        <label style={isRequiredStyling} >*</label>
                        <input id={control.id} disabled={control.isReadOnly} type="text" placeholder="custom control" value={control.textValue} onInput={({ currentTarget }: JSX.TargetedEvent<HTMLInputElement, Event>) => {
                            control.textValue = currentTarget.value;
                            session.refresh();
                        }} aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0} />
                        <Error control={control} />
                    </div>
    }
}


export function BooleanControls({ control }: InputFieldProps<boolean>) {
    const session: ApplicationSession = useContext(SessionContext);
    var isRequiredStyling="display: none;"
    if(control.isRequired){isRequiredStyling="display: inline-block;color:red;"}
    if((control.inputStyle) === "checkBox"){
    return <div key={control.id} class={`checkbox-field size-${control.layoutWidth}`}>
            <input id={control.id} type="checkbox" disabled={control.isReadOnly} checked={control.value} onInput={({ currentTarget }: JSX.TargetedEvent<HTMLInputElement, Event>) => {
                control.value = currentTarget.checked;
                session.refresh();
            }} aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0} />
            <label for={control.id} dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
            <Error control={control} />
        </div>
    }else if ((control.inputStyle) === "radioButtons") {
        return <div class={`radio-field size-${control.layoutWidth}`}>
                <fieldset role="radiogroup" style="display: inline-block;" aria-labelledby={"lbl-" + control.id} aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0} key={control.id}>
                    <legend id={"lbl-" + control.id} style="float: left;" dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
                     <label style={isRequiredStyling} >*</label>
                     <br></br>
                    {control.options.map((opt, idx) => (<>
                        <input id={control.id + "-opt" + idx}  role="radio" type="radio" name={control.id} disabled={control.isReadOnly} checked={control.value == opt.value} onInput={evt => {
                            control.value = opt.value;
                            session.refresh();
                        }} />
                        <label for={control.id + "-opt" + idx} dangerouslySetInnerHTML={{__html: localize(opt.textTranslationKey, opt.translationParameters, true)}}/>
                    </>))}
                    <Error control={control} />
                </fieldset>
            </div>;
    } else {
        //custom control code
        return <div key={control.id} class={`checkbox-field size-${control.layoutWidth}`}>
                    <input id={control.id} type="checkbox" style = "bottom: 5px;width: 26px;height: 12px;border: solid white;border-width: 0 4px 4px 0;-webkit-transform: rotate(45deg);-ms-transform: rotate(45deg);transform: rotate(45deg);"  disabled={control.isReadOnly} checked={control.value} onInput={({ currentTarget }: JSX.TargetedEvent<HTMLInputElement, Event>) => {
                        control.value = currentTarget.checked;
                        session.refresh();
                    }} aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0} />
                    <label for={control.id} style = "color:grey;" dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
                    <Error control={control} />
                </div>
    }
}


export function RecordControls({ control }: InputFieldProps<IARecordRef>) {
    const session: ApplicationSession = useContext(SessionContext);
        var isRequiredStyling="display: none;"
        if(control.isRequired){isRequiredStyling="display: inline-block;color:red;"}
    if((control.inputStyle) === "radioButtons"){
    return <div class={`radio-field size-${control.layoutWidth}`}>
            <fieldset role="radiogroup" aria-labelledby={"lbl-" + control.id} aria-describedby={"err-" + control.id} key={control.id}>
                <legend id={"lbl-" + control.id} style="float: left;" dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
                <label style={isRequiredStyling} >*</label>
                <br></br>
                {control.options.map(opt => (<label class="radio-option"><input role="radio" type="radio" name={control.id} disabled={control.isReadOnly} checked={opt.value.equals(control.value)} onInput={evt => {
                    control.value = opt.value;
                    session.refresh();
                }} /> {localize(opt.textTranslationKey, opt.translationParameters, false)}</label>))}
                <Error control={control} />
            </fieldset>
        </div>
    }else if ((control.inputStyle) === "dropDown") {
        const selectRef = useRef<HTMLSelectElement>(null);

            useEffect(() => {
                selectRef.current.selectedIndex = control.options.findIndex(opt => opt.value.equals(control.value));
            });

            return <div key={control.id} class={`select-field size-${control.layoutWidth}`}>
                <label for={control.id} style="display: inline-block;" dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
                <label style={isRequiredStyling} >*</label>
                <br></br>
                <select id={control.id} ref={selectRef} disabled={control.isReadOnly} onInput={({ currentTarget }: JSX.TargetedEvent<HTMLSelectElement, Event>) => {
                    control.value = control.options[currentTarget.value]?.value;
                    session.refresh();
                }} aria-describedby={"err-" + control.id} aria-invalid={control.errors.length > 0}>
                    {control.options.map((opt, idx) => <option value={idx}>{opt.text}</option>)}
                </select>
                <Error control={control} />
            </div>

    }else {
        //custom control code
        return <div class={`radio-field size-${control.layoutWidth}`}>
                    <fieldset role="radiogroup" aria-labelledby={"lbl-" + control.id} aria-describedby={"err-" + control.id} key={control.id}>
                       <legend id={"lbl-" + control.id} style="display: inline-block;" dangerouslySetInnerHTML={{__html: localize(control.htmlTranslationKey, control.translationParameters, true)}}/>
                       <label style={isRequiredStyling} >*</label>
                                       <br></br>
                        {control.options.map(opt => (<label class="radio-option"><input role="radio" type="checkbox" name={control.id} disabled={control.isReadOnly} checked={opt.value.equals(control.value)} onInput={evt => {
                            control.value = opt.value;
                            session.refresh();
                        }} /> {localize(opt.textTranslationKey, opt.translationParameters, false)}</label>))}
                        <Error control={control} />
                    </fieldset>
                </div>
    }
}

function guidGenerator() {
    var S4 = function() {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}


export function inputFactory(item: IAInputControl<any>) {
    switch (item.schemeId) {
        case "text":
        case "date-general":
        case "number-general":
        case "number-currency":
            return <TextFields control={item} />;
        case "text-area":
            return <TextFields control={item} />;
        case "boolean-checkbox":
            return <BooleanControls control={item} />;
        case "boolean-radio":
            return <BooleanControls control={item} />;
        case "reference-radio":
        case "radio":
            return <RecordControls control={item} />;
        case "reference-dropdown":
        case "dropdown":
            return <RecordControls control={item} />;
    }
    return <div>{item.schemeId}</div>
}
