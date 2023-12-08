import { DecisionServiceProject } from "ia-public/Project";
import { XmlElement } from "./Xml";
import { ModelAttribute, ModelAttributes, ModelEntities } from "./main";
import { MigrationSettings, logDocumentMigrationWarning } from "./MigratorCommon";
import { ContractField, ContractFieldType } from "ia-public/Contract";
import { newUID } from "./Util";

export function generateDecisionServiceContract(interviewModelXml: XmlElement,
    decisionServiceProject: DecisionServiceProject, attributeDetails: ModelAttributes,
    entityDetails: ModelEntities, settings: MigrationSettings) {
    
    let inputAttributesByEntity: { [key: string]: Set<string> } = {};
    let outputAttributesByEntity: { [key: string]: Set<string> } = {};
    let entityChildren: { [key: string]: Set<string> } = {};    

    function handleInterviewControl(controlEl: XmlElement) {
        if (controlEl.name === "AttributeInputControl") {
            let attributeId: string = controlEl.attributes["Attribute"];
            let attribute = attributeDetails[attributeId];

            let entityId = attribute.entity ? attribute.entity : "global";
            let entity = entityDetails[entityId];

            if (entity.isInferred) {
                // By definition, an inferred entity cannot form part of the input contract.
                return;
            }

            if (!inputAttributesByEntity[entityId]) {
                inputAttributesByEntity[entityId] = new Set<string>();
            }

            inputAttributesByEntity[entityId].add(attributeId);
        } else if (controlEl.name === "InterviewContainerControl" || controlEl.name === "EntityGroupControl") {
            for (const childControlEl of controlEl.select("Controls/*").elements) {
                handleInterviewControl(childControlEl);
            }
        } 
    }

    for (const controlEl of interviewModelXml.select("interview/screens/Screen/Controls/*").elements) {
        handleInterviewControl(controlEl);
    }

    let goalAttributes : Set<string> = new Set<string>();
    for (const el of interviewModelXml.select("interview/screen-order/goal-set/attr").elements) {
        let attrId = el.attributes["id"];
        goalAttributes.add(attrId);
    }


    for (const attributeId of Object.keys(attributeDetails)) {
        const attribute: ModelAttribute = attributeDetails[attributeId];
        let entityId = attribute.entity ? attribute.entity : "global";

        if (!inputAttributesByEntity[entityId]) {
            inputAttributesByEntity[entityId] = new Set<string>();
        }

        if (!outputAttributesByEntity[entityId]) {
            outputAttributesByEntity[entityId] = new Set<string>();
        }

        if (attribute.seedableFromUrlParameter || attribute.hasInputDataMapping) {
            inputAttributesByEntity[entityId].add(attributeId);
        }

        if (attribute.hasOutputDataMapping) {
            outputAttributesByEntity[entityId].add(attributeId);
        }

        if ((goalAttributes.has(attributeId)) && settings.decisionServiceContract && settings.decisionServiceContract.outputGoalAttributes) {
            outputAttributesByEntity[entityId].add(attributeId);
        }

        if (attribute.publicName && settings.decisionServiceContract && settings.decisionServiceContract.outputNonInputAttributesWithPublicNames && !inputAttributesByEntity[entityId].has(attributeId)) {
            outputAttributesByEntity[entityId].add(attributeId);
        }
    }

    for (const entityId of Object.keys(entityDetails)) {
        let entity = entityDetails[entityId];
        let parentEntityId = entity.parent;
        if (parentEntityId !== null) {
            if (!entityChildren[parentEntityId]) {
                entityChildren[parentEntityId] = new Set<string>();
            }

            entityChildren[parentEntityId].add(entityId);
        }
    }

    function processEntity(entityId: string, attributesByEntity: { [key: string]: Set<string> }) : ContractField[] {
        let fields: ContractField[] = [];

        if (attributesByEntity[entityId]) {
            for (const attributeId of attributesByEntity[entityId]) {
                let attribute = attributeDetails[attributeId];

                let fieldType: ContractFieldType;
                if (attribute.type === "boolean") {
                    fieldType = "boolean";
                } else if (attribute.type === "text") {
                    fieldType = "string";
                } else if (attribute.type === "number") {
                    fieldType = "number";
                } else if (attribute.type === "currency") {
                    fieldType = "number";
                } else if (attribute.type === "date") {
                    fieldType = "date";
                } else if (attribute.type === "datetime" || attribute.type === "timeofday") {
                    logDocumentMigrationWarning(`Attribute ${attribute.text}: type ${attribute.type} is not supported. This control has been omitted from the contract.`);
                    continue;
                }

                let attributeField: ContractField = {
                    uid: newUID(),
                    name: attribute.publicName ? attribute.publicName : attribute.text,
                    value: attribute.text,
                    type: fieldType
                }

                fields.push(attributeField);
            }
        }

        if (entityChildren[entityId]) {
            for (const childEntityId of entityChildren[entityId]) {
                let childEntity = entityDetails[childEntityId];

                if (!childEntity.isInferred) {
                    let childEntityFields = processEntity(childEntityId, attributesByEntity);

                    if (childEntityFields.length > 0) {
                        let recordListField: ContractField = {
                            uid: newUID(),
                            name: childEntity.publicName ? childEntity.publicName : childEntity.text,
                            value: childEntity.text,
                            type: "array",
                            properties: childEntityFields
                        }

                        fields.push(recordListField);
                    }
                }
            }
        }

        return fields;
    }

    let inputContract = processEntity("global", inputAttributesByEntity);
    let outputContract = processEntity("global", outputAttributesByEntity);

    decisionServiceProject.inputContract = { properties: inputContract };
    decisionServiceProject.outputContract = { properties: outputContract };
}

