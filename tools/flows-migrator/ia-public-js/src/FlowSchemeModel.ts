import {BooleanFormat, DateFormat, NumberFormat} from "./Format";
import {FlowInputStyle} from "./FlowModel";

export const flowSchemeIcons = ["dialog", "chat", "workflow", "task", "request", "flow"] as const;
export type FlowSchemeIcon = typeof flowSchemeIcons[number];

export type SchemeItemSchemaType = "string" | "number" | "boolean" | "array";

export type SchemeItemSchema =
    SchemeStringSchema
    | SchemeNumberSchema
    | SchemeBooleanSchema
    | SchemeArraySchema
    | SchemeArrayReferenceSchema;

export interface SchemeObjectSchema {
    type: "object";
    text?: string;
    properties: {
        [index: string]: SchemeItemSchema;
    }
}

export interface SchemeBooleanSchema {
    type: "boolean";
    text?: string;
    displayName?: string;
    references?: string;
}

export interface SchemeStringSchema {
    type: "string";
    text?: string;
    displayName?: string;
    format?: "date";
    references?: string;
}

export interface SchemeNumberSchema {
    type: "number";
    text?: string;
    displayName?: string;
    references?: string;
}

export interface SchemeArraySchema {
    type: "array";
    text?: string;
    displayName?: string;
    items: SchemeObjectSchema;
    namedRecords?: string[];
    identityProperty?: string;
    referenceProperty?: string;
}

export interface SchemeArrayReferenceSchema {
    type: "array";
    text?: string;
    displayName?: string;
    references: string;
    items: {
        type: "number" | "string"
    }
}

export interface SchemeDefaultFormatters {
    numberInput: string[],
    numberOutput: string,
    dateInput: string[];
    dateOutput: string;
}

export type SchemeFormatter = SchemeNumberFormat | SchemeDateFormat | SchemeBooleanFormat;

export interface SchemeNumberFormat {
    name: string;
    kind: "number";
    format: NumberFormat;
}

export interface SchemeDateFormat {
    name: string;
    kind: "date";
    format: DateFormat;
}

export interface SchemeBooleanFormat {
    name: string;
    kind: "boolean";
    format: BooleanFormat;
}

export interface LocalisationStrings {
    locale: string;
    dayFull: string[] //full days of the week starting with Sunday
    dayShort: string[] //short days of the week starting with Sunday
    monthFull: string[] //full month name starting with January
    monthShort: string[] //short month name starting with January
    trueValue: string,
    falseValue: string,
    nullValue: string,
    dateFormatError: string;
    numberFormatError: string;
    dateNotExistError: string;
    mandatoryError: string;
    invalidReturnedDataError: string;
    invalidValue: string;
}


export interface SchemeTemplate {
    template: string;
}

export type SchemeControl =
    | SchemeControlInput
    | SchemeControlReferenceListInput
    | SchemeControlPage
    | SchemeControlLabel
    | SchemeControlComment
    | SchemeControlValidation
    | SchemeControlSection
    | SchemeControlGroup
    | SchemeFlowItemGroup
    | SchemeControlData
    | SchemeControlConnectionDataAction
    | SchemeControlRecordCollect;

export type SchemeItemKind =
    "input"
    | "referenceList"
    | "page"
    | "label"
    | "comment"
    | "validation"
    | "recordCollect"
    | "section"
    | "group"
    | "flowItemGroup"
    | "dataAction"
    | "connectionDataAction";

export type SchemeControlCustomProperties = {
    [index: string]: {
        type: "string" | "number" | "boolean";
        kind: "static" | "rule"
    }
};

interface SchemeControlBase {
    id: string;
    text: string;
    kind: SchemeItemKind;
    disableHTML?: boolean;
    customProperties?: SchemeControlCustomProperties
}

export type SchemeControlInputDataType = "boolean" | "number" | "date" | "text" | "record";

export interface SchemeControlInput extends SchemeControlBase {
    kind: "input";
    dataType: SchemeControlInputDataType;
    inputStyle: FlowInputStyle;
    inputFormats?: string[]
    outputFormat?: string
}

export interface SchemeControlReferenceListInput extends SchemeControlBase {
    id: string;
    kind: "referenceList";
    dataType: string;
}

export interface SchemeControlPage extends SchemeControlBase {
    id: string;
    kind: "page";
}

export interface SchemeControlLabel extends SchemeControlBase {
    id: string;
    kind: "label";
}

export interface SchemeControlComment extends SchemeControlBase {
    id: string;
    kind: "comment";
}

export interface SchemeControlValidation extends SchemeControlBase {
    id: string;
    kind: "validation";
}

export interface SchemeControlRecordCollect extends SchemeControlBase {
    id: string;
    kind: "recordCollect";
}

interface SchemeControlSection extends SchemeControlBase {
    id: string;
    kind: "section";
}

export interface SchemeControlGroup extends SchemeControlBase {
    id: string;
    kind: "group";
}

export interface SchemeFlowItemGroup extends SchemeControlBase {
    id: string;
    kind: "flowItemGroup";
}

export interface SchemeControlData extends SchemeControlBase {
    id: string;
    kind: "dataAction";
    sendSchema?: SchemeObjectSchema;
    returnSchema?: SchemeObjectSchema;
    icon?: string;
    iconColor?: string;
}

export interface SchemeControlConnectionDataAction extends SchemeControlBase {
    id: string;
    kind: "connectionDataAction";
    connection?: string;
    connectionActionId?: string;
    sendSchema: SchemeObjectSchema;
    returnSchema: SchemeObjectSchema;
}

export interface SchemePaletteGroup {
    text: string;
    controls: SchemeControl[];
}

export interface SchemeConnectionObject {
    connection: string;
    connectionObjectId: string;
    connectionObjectText: string;

    kind: "connectionObject";

    displayName?: string;
    text?: string;
    returnSchema: SchemeObjectSchema;
}
