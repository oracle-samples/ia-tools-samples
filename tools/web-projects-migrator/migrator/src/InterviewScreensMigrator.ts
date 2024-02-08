import { FlowControlItem, FlowControlRow, FlowGroupControl, FlowInputControl, FlowInputStyle, FlowItemGroup, FlowLabelControl, FlowPage, FlowPageItem, FlowRecordCollectControl, FlowReferenceInputControl, FlowSection, OptionalStateConfiguration, ReadOnlyStateConfiguration, VisibleStateConfiguration } from "ia-public/FlowModel";
import { XmlElement } from "./Xml";
import { FlowProject, FlowSchemeProject } from "ia-public/Project";
import { newUID } from './Util'
import { SchemeControlInput } from "ia-public/FlowSchemeModel";
import { MigrationSettings, logDocumentMigrationWarning, opmInputStyle } from './MigratorCommon';
import { ModelAttributes, ModelEntities, ModelEntity, ModelRelationships} from './main'

enum ExpressionType {
    "if",
    "unless"
}

enum ExpressionOperator {
    "==",
    "!=",
    "relevant",
    "not_relevant"
}

interface IfExpr {
    type: ExpressionType,
    op: ExpressionOperator,
    attribute: string
    value: null | boolean
}

interface ProcessedControl {
    control: FlowControlItem,
    entityId: string | null
}

export function migrateScreens(interviewModelXml: XmlElement, flowProject: FlowProject, scheme: FlowSchemeProject, attributeDetails: ModelAttributes, 
    entityDetails: ModelEntities, relationshipDetails: ModelRelationships, publicNameToAttributeId: {[key: string] : string}, migrationSettings:MigrationSettings) {

    let settingsFlowControls = migrationSettings.flowControls ? migrationSettings.flowControls : {};
    let inputDataTypeToDefaultSchemeId: { [key: string]: { id: string, inputStyle: FlowInputStyle } } = {}
    let kindToDefaultSchemeId: { [key: string]: string } = {}
    let schemeIdToInputStyle: { [key: string]: FlowInputStyle } = {}

    // For any controls not mentioned in the settings.json file, default to the first control with a matching kind, or 
    // data type in the case of input controls.
    for (const paletteGroup of scheme.palette) {
        for (const schemeControl of paletteGroup.controls) {
            let kind = schemeControl.kind;
            let id = schemeControl.id;

            if (kind === "input") {
                let dataType = (schemeControl as SchemeControlInput).dataType;
                let inputStyle = (schemeControl as SchemeControlInput).inputStyle;

                schemeIdToInputStyle[id] = inputStyle;

                if (!(dataType in inputDataTypeToDefaultSchemeId)) {
                    inputDataTypeToDefaultSchemeId[dataType] = { id: id, inputStyle: inputStyle };
                }
            } else {
                if (!(kind in kindToDefaultSchemeId)) {
                    kindToDefaultSchemeId[kind] = id;
                }
            }
        }
    }

    let screenIdToStage: { [key: string]: string } = {}
    let stageIdToTitle: { [key: string]: string } = {}

    for (const el of interviewModelXml.select("interview/screen-order/ScreenOrderItemContainer").elements) {
        let stageId = el.attributes["ID"];
        let stageTitle = el.attributes["Title"];

        stageIdToTitle[stageId] = stageTitle;

        for (let screenEl of el.select("ScreenOrderScreen").elements) {
            let screenId = screenEl.attributes["Screen"];
            screenIdToStage[screenId] = stageId;
        }
    }

    let currentStageId: string = null;
    let currentStagePageGroup: FlowItemGroup = null;
    let currentPageGroupHierarchy: FlowItemGroup[] = null;
    for (const el of interviewModelXml.select("interview/screens/Screen").elements) {
        let screenId: string = el.attributes["ID"];
        let stageId: string = screenIdToStage[screenId];
        let stageTitle: string = stageIdToTitle[stageId];

        if (stageId !== currentStageId) {
            currentPageGroupHierarchy = [];

            currentStagePageGroup = {
                kind: "flowItemGroup",
                text: stageTitle,
                schemeId: getSetSchemeIdOrDefaultForKind("stage", "flowItemGroup"),
                uid: newUID(),
                rows: [],
                listName: "",
                visible: true,
                readOnly: false,
                optionFilter: false
            }
            
            flowProject.flow.rows.push(currentStagePageGroup);
        }

        currentStageId = stageId;

        let showCondition: string = el.attributes["ShowCondition"];

        console.error("Converting screen '" + el.attributes["Title"] + "'");

        let title: string = handleTextSubstitution(el.attributes["Title"]);
        let page: FlowPage = {
            kind: "page",
            uid: newUID(),
            schemeId: getSetSchemeIdOrDefaultForKind("screen", "page"),
            rows: [],
            text: title,
            visible: true,
            readOnly: false
        }

        // Can't show if relevant.. otherwise in flows. Relevant wins
        let showScreenExprAttributeId;
        let showScreenExpr: XmlElement = el.selectFirst("ShowScreenExpression");
        if (showCondition === "relevant") {
            page.visibleIf = "relevant";

            if (showScreenExpr !== null) {
                logDocumentMigrationWarning(`Show if relevant, otherwise... rules are not supported for flow screens. The "otherwise..." clause has been omitted.`);
            }
        } else {
            // Check for show screen expression
            if (showScreenExpr !== null) {
                let parsedExpression: IfExpr = parseIfExpr(showScreenExpr);
                if (parsedExpression != null) {
                    if (parsedExpression.type === ExpressionType.if) {
                        page.visibleIf = "if";
                    } else if (parsedExpression.type === ExpressionType.unless) {
                        page.visibleIf = "unless";
                    }

                    if (parsedExpression.attribute) {
                        showScreenExprAttributeId = parsedExpression.attribute;
                        page.visibleCondition = buildExpressionCondition(parsedExpression.attribute, parsedExpression.value);
                    }
                }
            }
        }

        let processedControls: ProcessedControl[] = [];
        for (const controlEl of el.select("Controls/*").elements) {
            // ShowIfExpr
            let processedControl: ProcessedControl = handleControl(controlEl);
            if (processedControl) {
                processedControls.push(processedControl);
                let row: FlowControlRow = {
                    kind: "row",
                    uid: newUID(),
                    controls: [processedControl.control]
                }
                page.rows.push(row);
            }
        }

        let screenEntityId = getScreenEntityForControls(processedControls);

        if (!screenEntityId && showScreenExprAttributeId) {
            screenEntityId = attributeDetails[showScreenExprAttributeId]["entity"];
        }

        // Figure out what the entity is for the screen
        // If the first input control on the screen is an attribute input control, the screen will belong to the same entity as the attribute.
        // If the first input control on the screen is a relationship input control, the screen will belong to the source of the relationship.
        // If the first control on the screen is an entity collect control, the screen will belong to the parent of the entity being collected.
        // If the first control on the screen is an entity-level form control, the screen will belong to the same entity as the form.
        // If the screen contains no input control, the screen will derive its entity from the screen's visibility attribute if one is specified, otherwise it will be deemed to be in the global entity.
        // The last screen in the interview is always considered be in the global entity.

        if (screenEntityId && screenEntityId !== "global") {
            let screenEntity: ModelEntity= entityDetails[screenEntityId];
            let entityRecordListName = createRecordListNameForEntity(screenEntity);

            // if there is a current page group
            // if it is for the same entity
            // or this one is a child entity

            // if parent is global - new page group add to flow directly
            // if page group for screen entity in hierarchy -> add page to it
            // if page group for parent of screen entity -> new page group, add to group for parent entity
            let parentEntity: ModelEntity = screenEntity.parent === null ? null : entityDetails[screenEntity.parent];
            let addTo : FlowItemGroup | FlowSection = null;
            let createNewPageGroup = false;

            for (let i = currentPageGroupHierarchy.length -1; i >= 0; i--) {
                let pageGroup : FlowItemGroup = currentPageGroupHierarchy[i];
                if (entityRecordListName === pageGroup.listName) {
                    addTo = pageGroup;
                    currentPageGroupHierarchy = currentPageGroupHierarchy.slice(0, i + 1);
                    break;
                } else if (parentEntity && parentEntity.containmentRelationship && createRecordListNameForEntity(parentEntity) === pageGroup.listName) {
                    addTo = pageGroup;
                    createNewPageGroup = true;
                    currentPageGroupHierarchy = currentPageGroupHierarchy.slice(0, i + 1);
                    break;
                }
            }

            if (addTo === null) {
                if (parentEntity.text === "global") {
                    addTo = currentStagePageGroup;
                    createNewPageGroup = true;
                    currentPageGroupHierarchy = [];
                } else {
                    // The screen entity hierarchy has skipped over one or more entities between the global and the screen entity. Need to add these in.
                    let pageGroupsToAdd : FlowItemGroup[] = [];

                    let entityToAdd : ModelEntity = parentEntity
                    while (entityToAdd.text !== "global") {
                        let newPageGroup: FlowItemGroup = {
                            kind: "flowItemGroup",
                            text: "Page group",
                            schemeId: getSetSchemeIdOrDefaultForKind("entityScreenGroup", "flowItemGroup"),
                            uid: newUID(),
                            rows: [],
                            listName: createRecordListNameForEntity(entityToAdd),
                            visible: true,
                            readOnly: false,
                            optionFilter: false
                        }

                        pageGroupsToAdd.unshift(newPageGroup);
                        entityToAdd = entityDetails[entityToAdd.parent];
                    }

                    for (let i=0; i < pageGroupsToAdd.length; i++) {
                        let pageGroup = pageGroupsToAdd[i];

                        if (i < pageGroupsToAdd.length - 1) {
                            let childPageGroup = pageGroupsToAdd[i + 1];
                            pageGroup.rows.push(childPageGroup);
                        }

                        currentPageGroupHierarchy.push(pageGroup);
                    }

                    addTo = pageGroupsToAdd[pageGroupsToAdd.length - 1];
                    createNewPageGroup = true;
                    currentStagePageGroup.rows.push(pageGroupsToAdd[0]);
                }
            }

            if (createNewPageGroup) {
                let newPageGroup: FlowItemGroup = {
                    kind: "flowItemGroup",
                    text: "Page group",
                    schemeId: getSetSchemeIdOrDefaultForKind("entityScreenGroup", "flowItemGroup"),
                    uid: newUID(),
                    rows: [page],
                    listName: entityRecordListName,
                    visible: true,
                    readOnly: false,
                    optionFilter: false
                }

                addTo.rows.push(newPageGroup);
                currentPageGroupHierarchy.push(newPageGroup);
            } else {
                addTo.rows.push(page)
            }
        } else {
            currentStagePageGroup.rows.push(page);
            currentPageGroupHierarchy = [];
        }
    }

    function createRecordListNameForEntity(entity: ModelEntity) : string {
        let entityOrAncestorInferred = false;
        let currentEntity = entity;
        do {
            if (currentEntity.isInferred) {
                entityOrAncestorInferred = true;
            }
            currentEntity = entityDetails[currentEntity.parent];
        } while (currentEntity.parent !== null)

        if (entityOrAncestorInferred) {
            let innerCurrentEntity: ModelEntity = entity;
            let objectPathItems: string[] = [];
            do {
                objectPathItems.unshift(relationshipDetails[innerCurrentEntity.containmentRelationship].text);
                innerCurrentEntity = entityDetails[innerCurrentEntity.parent];
            } while (innerCurrentEntity.parent !== null)

            return "@@" + objectPathItems.join(":");
        } else {
            let entityContainmentRelationshipText = relationshipDetails[entity.containmentRelationship].text;
            return entityContainmentRelationshipText;
        }
    }

    function handleControl(controlEl: XmlElement): ProcessedControl {
        let controlEntityId: string // used to determine the screen entity, defaults to global
        let control: FlowControlItem = null;

        if (controlEl.name === "LabelControl") {
            let caption = handleTextSubstitution(controlEl.attributes["Caption"]);
            if (!caption) {
                caption = "";
            }
            let labelControl: FlowLabelControl = {
                kind: "label",
                uid: newUID(),
                schemeId: getSetSchemeIdOrDefaultForKind("label", "label"),
                text: caption,
                width: 12,
                visible: true
            }
            control = labelControl;
        } else if (controlEl.name === "AttributeInputControl") {
            let attributeId: string = controlEl.attributes["Attribute"];
            let caption: string = handleTextSubstitution(controlEl.attributes["Caption"]);
            let opmInputStyle:opmInputStyle = convertOpmInputStyleFromXml(controlEl.attributes["InputStyle"])

            let attributeText: string = attributeDetails[attributeId].text;
            let attributeType: string = attributeDetails[attributeId].type;
            
            let hasValueList: boolean = attributeDetails[attributeId].hasValueList

            if (hasValueList) {
                logDocumentMigrationWarning(`Attribute "${attributeText}": value list references are not supported`);
            }

            if (controlEl.selectFirst("ManualList") !== null) {
                logDocumentMigrationWarning(`Attribute "${attributeText}": manual lists are not supported`);
            }

            if (!caption) {
                caption = attributeText;
            }

            let inputControl: FlowInputControl = {
                kind: "input",
                uid: newUID(),
                fieldName: attributeText,
                dataType: "",
                schemeId: "",
                question: caption,
                value: "",
                width: 12,
                inputStyle: "custom",
                required: false,
                visible: true,
                readOnly: false
            }

            processHideIfExpression(controlEl, inputControl); // HideIfExpr
            processOptionalIfExpression(controlEl, inputControl); // OptionalIfExpr
            processReadOnlyIfExpression(controlEl, inputControl); // ReadOnlyIfExpr

            let handleInputDataType = function (attributeType: string) {
                // No specific currency type in flows

                if (attributeType === "currency") {
                    inputControl.dataType = "number";
                } else {
                    inputControl.dataType = attributeType;
                }

                // If a control to use for the input data type/input style has been specified in the settings.json use that, 
                // otherwise use the first matching control for the input data type that is found in the scheme
                if (settingsFlowControls.input && settingsFlowControls.input[attributeType] && settingsFlowControls.input[attributeType][opmInputStyle]) {
                    inputControl.schemeId = settingsFlowControls.input[attributeType][opmInputStyle];
                    inputControl.inputStyle = schemeIdToInputStyle[inputControl.schemeId];
                } else {
                    inputControl.inputStyle = inputDataTypeToDefaultSchemeId[attributeType]["inputStyle"];
                    inputControl.schemeId = inputDataTypeToDefaultSchemeId[attributeType]["id"];
                }
            }

            if (attributeType === "boolean") {
                handleInputDataType("boolean");
                inputControl.trueCaption = scheme.localisationStrings.trueValue;
                inputControl.falseCaption = scheme.localisationStrings.falseValue;
            } else if (attributeType === "text") {
                handleInputDataType("text");
            } else if (attributeType === "number") {
                handleInputDataType("number");
            } else if (attributeType === "currency") {
                // No separate currency type in flows. Check if there are configuration settings for the currency type, otherwise
                // use defaults for number type
                if (settingsFlowControls.input && settingsFlowControls.input["currency"]) {
                    handleInputDataType("currency");
                } else {
                    handleInputDataType("number");
                }

            } else if (attributeType === "date") {
                handleInputDataType("date");
            } else if (attributeType === "datetime" || attributeType === "timeofday") {
                logDocumentMigrationWarning(`Attribute ${attributeText}: type ${attributeType} is not supported. This control has been omitted from the converted screen.`);
                return null;
            } else {
                throw "Unknown attribute type " + attributeType;
            }

            control = inputControl;
            controlEntityId = attributeDetails[attributeId]["entity"];
        } else if (controlEl.name === "InterviewContainerControl") {
            let controlGroup: FlowGroupControl = {
                kind: "group",
                uid: newUID(),
                schemeId: getSetSchemeIdOrDefaultForKind("container", "group"),
                text: "Container",
                rows: [],
                listName: "",
                readOnly: false,
                visible: true,
                optionFilter: true
            }

            processHideIfExpression(controlEl, controlGroup); // HideIfExpr
            processReadOnlyIfExpression(controlEl, controlGroup); // ReadOnlyIfExpr

            let processedControls : ProcessedControl[] = [];
            for (const childControlEl of controlEl.select("Controls/*").elements) {
                let processedChildControl: ProcessedControl = handleControl(childControlEl);
                processedControls.push(processedChildControl);
            }

            for (let processedChildControl of processedControls) {
                if (processedChildControl) {
                    let row: FlowControlRow = {
                        kind: "row",
                        uid: newUID(),
                        controls: [processedChildControl.control]
                    }
                    controlGroup.rows.push(row);
                }
            }

            if (controlGroup.rows.length > 0) {
                control = controlGroup;
                controlEntityId = getScreenEntityForControls(processedControls);
            }
        } else if (controlEl.name === "EntityGroupControl") {
            let entityId: string = controlEl.attributes["Entity"];
            let entity: ModelEntity = entityDetails[entityId];

            let controlGroup: FlowGroupControl = {
                kind: "group",
                uid: newUID(),
                schemeId: getSetSchemeIdOrDefaultForKind("entityContainer", "group"),
                text: "Control group",
                rows: [],
                listName: createRecordListNameForEntity(entity),
                readOnly: false,
                visible: true,
                optionFilter: true
            }

            processHideIfExpression(controlEl, controlGroup); 
            processReadOnlyIfExpression(controlEl, controlGroup); 

            for (const childControlEl of controlEl.select("Controls/*").elements) {
                let processedChildControl: ProcessedControl = handleControl(childControlEl);

                if (processedChildControl) {
                    let row: FlowControlRow = {
                        kind: "row",
                        uid: newUID(),
                        controls: [processedChildControl.control]
                    }
                    controlGroup.rows.push(row);

                    if (processedChildControl.entityId && !controlEntityId) {
                        controlEntityId = processedChildControl.entityId;
                    }
                }
            }

            if (controlGroup.rows.length > 0) {
                control = controlGroup;
            }
        } else if (controlEl.name === "EntityCollectControl") {
            let relationshipId = controlEl.attributes["Relationship"];
            let relationshipText = relationshipDetails[relationshipId]["text"];

            let recordCollect: FlowRecordCollectControl = {
                kind: "recordCollect",
                uid: newUID(),
                schemeId: getSetSchemeIdOrDefaultForKind("entityCollect", "recordCollect"),
                text: "Record collect",
                rows: [],
                fieldName: relationshipText,
                required: false,
                visible: true,
                readOnly: false
            }

            processHideIfExpression(controlEl, recordCollect); // HideIfExpr
            processOptionalIfExpression(controlEl, recordCollect); // OptionalIfExpr
            processReadOnlyIfExpression(controlEl, recordCollect); // ReadOnlyIfExpr

            for (const childControlEl of controlEl.select("Controls/*").elements) {
                // HideIfExpr
                let childControl = handleControl(childControlEl);
                if (childControl) {
                    let row: FlowControlRow = {
                        kind: "row",
                        uid: newUID(),
                        controls: [childControl.control]
                    }
                    recordCollect.rows.push(row);
                }
            }

            control = recordCollect;
            controlEntityId = relationshipDetails[relationshipId]["source"];
        } else if (controlEl.name === "ReferenceRelationshipControl") {
            let relationshipId = controlEl.attributes["Relationship"];

            let caption = handleTextSubstitution(controlEl.attributes["Caption"]);
            let opmInputStyle = controlEl.attributes["InputStyle"];

            let relationshipType = relationshipDetails[relationshipId]["type"];
            let relationshipText = relationshipDetails[relationshipId]["text"];

            if (!caption) {
                caption = relationshipText;
            }

            let targetEntityId = relationshipDetails[relationshipId]["target"];
            let targetEntityIdentifyingAttributeId = entityDetails[targetEntityId]["identifyingAttributeId"];
            let targetEntityIdentifyingAttributeText = attributeDetails[targetEntityIdentifyingAttributeId]["text"];

            let targetEntityContainmentRelationshipId = entityDetails[targetEntityId]["containmentRelationship"];
            let targetEntityContainmentRelationshipText = relationshipDetails[targetEntityContainmentRelationshipId]["text"];

            // one to one and many to one -> Record input
            // one to many and many to many -> Multiselect input

            let referenceControl: FlowInputControl | FlowReferenceInputControl; 

            if (relationshipType === "OneToOne" || relationshipType === "ManyToOne") {
                referenceControl = {
                    kind: "input",
                    uid: newUID(),
                    fieldName: relationshipText,
                    dataType: "",
                    schemeId: "",
                    question: caption,
                    value: "",
                    width: 12,
                    inputStyle: "custom",
                    required: false,
                    visible: true,
                    readOnly: false
                }

                if (settingsFlowControls.referenceRelationship && settingsFlowControls.referenceRelationship.toOne && settingsFlowControls.referenceRelationship.toOne[opmInputStyle]) {
                    referenceControl.schemeId = settingsFlowControls.referenceRelationship.toOne[opmInputStyle];
                    referenceControl.inputStyle = schemeIdToInputStyle[referenceControl.schemeId];
                } else {
                    referenceControl.inputStyle = inputDataTypeToDefaultSchemeId["record"]["inputStyle"];
                    referenceControl.schemeId = inputDataTypeToDefaultSchemeId["record"]["id"];
                }

            } else {
                referenceControl = {
                    kind: "referenceInput",
                    uid: newUID(),
                    fieldName: relationshipText,
                    dataType: targetEntityContainmentRelationshipText,
                    schemeId: null,
                    displayField: targetEntityIdentifyingAttributeText,
                    inlineOptions: [],
                    question: caption,
                    value: "",
                    width: 12,
                    inputStyle: "checkBox",
                    required: false,
                    visible: true,
                    readOnly: false,
                    optionFilter: false
                }

                if (settingsFlowControls.referenceRelationship && settingsFlowControls.referenceRelationship.toMany && settingsFlowControls.referenceRelationship.toMany[opmInputStyle]) {
                    referenceControl.schemeId = settingsFlowControls.referenceRelationship.toMany[opmInputStyle];
                    referenceControl.inputStyle = schemeIdToInputStyle[referenceControl.schemeId];
                } else {
                    referenceControl.inputStyle = "checkBox"; // Input style has to be checkbox
                    referenceControl.schemeId = kindToDefaultSchemeId["referenceList"];
                }
            }

            processHideIfExpression(controlEl, referenceControl); // HideIfExpr
            processOptionalIfExpression(controlEl, referenceControl); // OptionalIfExpr
            processReadOnlyIfExpression(controlEl, referenceControl); // ReadOnlyIfExpr

            controlEntityId = relationshipDetails[relationshipId]["source"];
            control = referenceControl;
        } else {
            logDocumentMigrationWarning(`No conversion available for control type "${controlEl.name}". This control has been omitted from the converted screen.`)
        }

        if (control === null) {
            return null;
        } else {
            return { control: control, entityId: controlEntityId };
        }
    }

    function buildExpressionCondition(attributeId: string, value: null | boolean): string {
        let attributeText = attributeDetails[attributeId]["text"];

        let condition = attributeText;

        if (value === null) {
            condition = condition + " = null"
        } else if (value === false) {
            condition = condition + " = false"
        }

        return condition;
    }

    function parseIfExpr(el: XmlElement): IfExpr {
        ExpressionType.if
        let parsedExpression: IfExpr = {
            type: ExpressionType.if,
            op: ExpressionOperator["=="],
            attribute: "",
            value: null
        }

        let type = el.attributes["ExprType"];
        let operator = el.attributes["Op"];

        let conversionFailure = false;
        if (operator === "In") {
            conversionFailure = true;
        }

        let values: XmlElement[] = el.select("Values/*").elements;
        if (values.length > 1) {
            conversionFailure = true;
        } else if (values.length > 0) {
            let singleValue: XmlElement = values[0];
            if (singleValue.name !== "Boolean") {
                conversionFailure = true;
            } else {
                parsedExpression.value = (singleValue.text() === "true");
            }
        }

        if (conversionFailure === true) {
            let attributeId = el.attributes["Attribute"];
            let attributeText = attributeDetails[attributeId].text
            logDocumentMigrationWarning("Couldn't convert expression referencing value list '" + attributeText + "'");
            return null;
        }

        if (type === "If") {
            parsedExpression.type = ExpressionType.if
        } else if (type === "Unless") {
            parsedExpression.type = ExpressionType.unless
        }

        if (operator === "==") {
            parsedExpression.op = ExpressionOperator["=="];
        } else if (operator === "!=") {
            parsedExpression.op = ExpressionOperator["!="];
        } else if (operator === "Relevant") {
            parsedExpression.op = ExpressionOperator.relevant
        } else if (operator === "NotRelevant") {
            parsedExpression.op = ExpressionOperator.not_relevant
        }

        parsedExpression.attribute = el.attributes["Attribute"];

        return parsedExpression;
    }

    function processHideIfExpression(controlEl: XmlElement, control: VisibleStateConfiguration) {
            let hideIfExpr: XmlElement = controlEl.selectFirst("HideIfExpr");
            if (hideIfExpr !== null) {
                let parsedExpression: IfExpr = parseIfExpr(hideIfExpr);
                if (parsedExpression !== null) {
                    if (parsedExpression.op === ExpressionOperator.relevant || parsedExpression.op === ExpressionOperator.not_relevant) {
                        control.visibleIf = "relevant";
                    } else {
                        if (parsedExpression.type === ExpressionType.unless) {
                            control.visibleIf = "if";
                        } else if (parsedExpression.type === ExpressionType.if) {
                            control.visibleIf = "unless";
                        }

                        if (parsedExpression.attribute) {
                            control.visibleCondition = buildExpressionCondition(parsedExpression.attribute, parsedExpression.value);
                        }
                    }
                }
            }
    }

    function processOptionalIfExpression(controlEl: XmlElement, control: OptionalStateConfiguration) {
        let optionalIfExpr: XmlElement = controlEl.selectFirst("OptionalIfExpr");
        if (optionalIfExpr !== null) {
            let parsedExpression: IfExpr = parseIfExpr(optionalIfExpr);
            if (parsedExpression !== null) {
                if (parsedExpression.op === ExpressionOperator.relevant || parsedExpression.op === ExpressionOperator.not_relevant) {
                    logDocumentMigrationWarning("Optional if relevant/not relevant rules are not supported in flows. This rule has been omitted.");
                } else {
                    if (parsedExpression.type === ExpressionType.unless) {
                        control.requiredIf = "if";
                    } else if (parsedExpression.type === ExpressionType.if) {
                        control.requiredIf = "unless";
                    }

                    if (parsedExpression.attribute) {
                        control.requiredCondition = buildExpressionCondition(parsedExpression.attribute, parsedExpression.value);
                    }
                }
            }
        }
    }

    function processReadOnlyIfExpression(controlEl: XmlElement, control: ReadOnlyStateConfiguration) {
        let readOnlyIfExpr: XmlElement = controlEl.selectFirst("ReadOnlyIfExpr");
        if (readOnlyIfExpr !== null) {
            let parsedExpression: IfExpr = parseIfExpr(readOnlyIfExpr);
            if (parsedExpression !== null) {
                if (parsedExpression.op === ExpressionOperator.relevant || parsedExpression.op === ExpressionOperator.not_relevant) {
                    logDocumentMigrationWarning("Read only if relevant/not relevant rules are not supported in flows. This rule has been omitted.");
                } else {
                    if (parsedExpression.type === ExpressionType.if) {
                        control.readOnlyIf = "if";
                    } else if (parsedExpression.type === ExpressionType.unless) {
                        control.readOnlyIf = "unless";
                    }

                    if (parsedExpression.attribute) {
                        control.readOnlyCondition = buildExpressionCondition(parsedExpression.attribute, parsedExpression.value);
                    }
                }
            }
        }
    }

    function handleTextSubstitution(caption: string) : string {
        if (caption) {
            const regex: RegExp = /%([^%\s]+)%/g

            let modifiedCaption = caption;
            let match;
            while ((match = regex.exec(caption)) !== null) {
                let capturedValue = match[1];
                if (capturedValue in publicNameToAttributeId) {
                    let attributeId = publicNameToAttributeId[capturedValue];
                    let substitutionValue = attributeDetails[attributeId]["text"];
                    modifiedCaption = modifiedCaption.replace('%' + capturedValue + '%', '<code>' + substitutionValue + '</code>');
                }
            }

            return modifiedCaption;
        } else {
            return caption;
        }
    }

    function convertOpmInputStyleFromXml(xmlStyle:string) : opmInputStyle {
        const unchangedTypes = [
            "checkbox", "dmy-inputs", "searching-combo", "text-area", "custom",
            "masked", "hms-inputs", "dmyhms-inputs", "text-button-group", "image-button-group",
            "text-image-button-group", "slider", "switch", "password"
        ];
    
        if (unchangedTypes.includes(xmlStyle)) {
            return xmlStyle as opmInputStyle;
        } else if (xmlStyle === "checkedbutton") {
            return "image-button";
        } else if (xmlStyle === "Dropdown") {
            return "drop-down";
        } else if (xmlStyle === "Radiobutton") {
            return "radio-button";
        } else if (xmlStyle === "Calendar") {
            return "calendar"
        } else if (xmlStyle === "Listbox") {
            return "listbox";
        } else if (xmlStyle === "TextBox") {
            return "text";
        } else {
            throw new Error("Unrecognised input style: " + xmlStyle);
        }
    }

    function getSetSchemeIdOrDefaultForKind(opmControlName: string, kind: string) : string {
        if (migrationSettings.flowControls && opmControlName in migrationSettings.flowControls) {
            return migrationSettings.flowControls[opmControlName];
        } else {
            return kindToDefaultSchemeId[kind];
        }
    }

    function getScreenEntityForControls(processedControls : ProcessedControl[]) : string {
        if (processedControls.length > 0) {
            let screenEntityId;

            // ignore unhandled controls e.g. image controls (represented as null), as well as label controls here. They are not relevant.
            let filteredControls : ProcessedControl[] = [];
            for (const processedControl of processedControls) {
                if (processedControl) {
                    if (processedControl.entityId) {
                        filteredControls.push(processedControl);
                    }
                }
            }

            if (filteredControls.length === 0) {
                return null;
            }

            let firstControl: ProcessedControl;
            let firstInputControl: ProcessedControl;

            for (const processedControl of filteredControls) {
                if (!firstControl) {
                    firstControl = processedControl;
                }

                if (processedControl && (processedControl.control.kind === "input" || processedControl.control.kind === "referenceInput")) {
                    firstInputControl = processedControl;
                    break;
                }
            }

            if (firstInputControl) {
                screenEntityId = firstInputControl.entityId
            } else {
                screenEntityId = firstControl.entityId
            }

            return screenEntityId;
        }

        return null;
    }
}
