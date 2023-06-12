export interface FlowControlRow {
    kind: "row",
    uid: string;
    controls: FlowControlItem[];
}

export interface FlowGoal {
    uid: string;
    goal: string;
}

export type FlowRowItemContainer = FlowPage | FlowItemGroup | FlowGroupControl | FlowSection | FlowRecordCollectControl;

export type FlowPageItem = FlowPage | FlowItemGroup | FlowSection | FlowDataAction | FlowComment;

export type FlowRowItem = FlowControlRow | FlowPageItem;

export type FlowControlItem =  FlowLabelControl | FlowInputControl | FlowReferenceInputControl | FlowValidationControl | FlowRecordCollectControl | FlowGroupControl | FlowComment | FlowDataAction;
export type FlowItem = FlowControlItem | FlowPage | FlowItemGroup | FlowSection | FlowDataAction;

export interface OptionFilterConfiguration {
    optionFilter: boolean;
    optionFilterIf?: null |"if" | "unless";
    optionFilterCondition?: string;
}

export const ObjectNameExpression = "<custom expression>"

export interface OptionExpressionConfiguration {
    targetObjectName?: string;
    optionListExpression?: string;
}

export interface VisibleStateConfiguration {
    visible: boolean;
    visibleIf?: null | "if" | "unless" | "relevant";
    visibleCondition?: string;
}

export interface ReadOnlyStateConfiguration {
    readOnly: boolean;
    readOnlyIf?: null | "if" | "unless";
    readOnlyCondition?: string;

}

export interface OptionalStateConfiguration {
    required: boolean;
    requiredIf?: null | "if" | "unless";
    requiredCondition?: string;
}

export interface FlowSection {
    kind: "section";
    text: string;
    uid: string;
    schemeId: string;
    rows: FlowPageItem[];
    goals: FlowGoal[];
    schemeDataMapping: FlowMapping;
}

export interface FlowPage extends VisibleStateConfiguration, ReadOnlyStateConfiguration {
    kind: "page";
    uid: string;
    schemeId: string;
    rows: FlowControlRow[];
    text: string;
}

export interface FlowLabelControl extends VisibleStateConfiguration {
    kind: "label";
    uid: string;
    schemeId: string;
    text: string;
    width: number;
}

export interface FlowComment {
    kind: "comment";
    uid: string;
    schemeId: string;
    text: string;
}

export interface FlowMapping {
    uid: string;
}

export interface FlowDataAction extends VisibleStateConfiguration {
    kind: "dataAction";
    uid: string;
    schemeId: string;
    text: string;
    inputMapping: any;
    outputMapping: any;
    requireValidData: boolean;
}

export interface FlowValidationControl extends VisibleStateConfiguration {
    kind: 'validation',
    uid: string;
    schemeId: string;
    text: string;
    rule: string;
    width: number;
}

export interface FlowRecordCollectControl extends OptionalStateConfiguration, VisibleStateConfiguration, ReadOnlyStateConfiguration, OptionalStateConfiguration {
    kind: 'recordCollect'
    uid: string;
    schemeId: string;
    text: string;
    rows: FlowControlRow[];
    fieldName: string;
    blankInstances?: string;
    validationRules?: FlowInputValidationRule[];
}

export interface FlowGroupControl extends VisibleStateConfiguration, ReadOnlyStateConfiguration, OptionFilterConfiguration, OptionExpressionConfiguration {
    kind: 'group'
    uid: string;
    schemeId: string;
    text: string;
    rows: FlowControlRow[];
    listName: string;
    readOnly: boolean;
    readOnlyIf?: null | "if";
    readOnlyCondition?: string;
}

export interface FlowItemGroup extends VisibleStateConfiguration, ReadOnlyStateConfiguration, OptionFilterConfiguration, OptionExpressionConfiguration {
    kind: 'flowItemGroup';
    text: string;
    schemeId: string;
    uid: string;
    rows: FlowPageItem[];
    listName: string;
}

export type FlowInputStyle = "radioButtons" | "checkBox" | "textBox" | "textArea" | "dropDown" | "custom";
export type ListOrientation = "horizontal" | "vertical";

export type ValidationType = "required" | "maxlen" | "minlen" | "regexp" | "whole" | "atleast" | "atmost" | "condition";

export interface FlowInputValidationRule {
    uid: string;
    validationType: ValidationType;
    threshold?: string;
    rule?: string;
    value?: string;
    message: string;
}

export interface FlowInputControl extends OptionalStateConfiguration, VisibleStateConfiguration, ReadOnlyStateConfiguration {
    kind: "input";
    uid: string;
    fieldName: string;
    dataType: string;
    schemeId: string;

    question: string;
    value: string;
    width: number;
    inputStyle: FlowInputStyle;
    validationRules?: FlowInputValidationRule[];

    // for radio buttons
    trueCaption?: string;
    falseCaption?: string;
}

export interface FlowReferenceInlineOption extends VisibleStateConfiguration {
    uid: string;
    text: string;
    value: string;
}

export interface FlowReferenceInputControl extends OptionalStateConfiguration, VisibleStateConfiguration, ReadOnlyStateConfiguration, OptionFilterConfiguration, OptionExpressionConfiguration {
    kind: "referenceInput";
    uid: string;
    fieldName: string;
    dataType: string;
    schemeId: string;
    displayField: string;
    inlineOptions: FlowReferenceInlineOption[];

    question: string;
    value: string;
    width: number;
    inputStyle: FlowInputStyle;
    validationRules?: FlowInputValidationRule[];
}

export function getControlSizeClass(width: number | null) {
    if (width == null)
        return null;
    return "interview-item-size-" + width;
}
