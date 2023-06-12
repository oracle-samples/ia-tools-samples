/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { XmlElement } from './Xml'
import { StringUtil } from './Util'

export interface XgenDataModel {
    entities:XgenEntity[];
    entitiesById:{
        [id:string]:XgenEntity;
    }
    attributesById:{
        [id:string]:XgenAttribute;
    }
    attributesByText:{
        [ncText:string]:XgenAttribute;
    }
    relationshipsById:{
        [id:string]:XgenRelationship;
    }
}

export interface XgenEntity {
    id:string;
    name:string;
    attributes:XgenAttribute[];

    /** Relationship that targets this entity and contains all instances of it */
    containmentRel:XgenRelationship;

    identifyingAttr:XgenAttribute;
}

export interface XgenRelationship {
    id:string;
    text:string;
    source:XgenEntity;
    target:XgenEntity;
    reverse:XgenRelationship;
}

export interface XgenAttribute {
    id:string;
    text:string;
    type:string;
    entity:XgenEntity;
}

export function parseXgenDataModel(xgen:XmlElement):XgenDataModel {
    const model:XgenDataModel = {
        entities:[],
        entitiesById:{},
        attributesById:{},
        attributesByText:{},
        relationshipsById:{}
    }

    for(const xmlEntity of xgen.select("root/entities/entity").elements) {
        let entity:XgenEntity;
        if (xmlEntity.attributes.ref === "global") {
            entity = { id:'global', name:'global', attributes:[], containmentRel:null, identifyingAttr:null }
        } else {
            entity = { id:xmlEntity.attributes.id, name:xmlEntity.attributes.name, attributes:[], containmentRel:null, identifyingAttr:null }
        }
        model.entities.push(entity);
        model.entitiesById[entity.id] = entity;

        for(const xmlAttr of xmlEntity.select("attribute").elements) {
            const text = xmlAttr.select("text/base").text();
            const attr:XgenAttribute = {
                id:xmlAttr.attributes.name,
                text:text,
                type:xmlAttr.attributes.type,
                entity:entity
            }
            entity.attributes.push(attr);
            model.attributesById[attr.id] = attr;
            model.attributesByText[StringUtil.nc(attr.text)] = attr;
        }

        const idAttrId = xmlEntity.attributes["identifying-attribute-name"];
        if (idAttrId) {
            entity.identifyingAttr = model.attributesById[idAttrId];
        }
    }
    for(const xmlRelationship of xgen.select("root/relationships/relationship").elements) {
        const source = model.entitiesById[xmlRelationship.attributes["source"]];
        const target = model.entitiesById[xmlRelationship.attributes["target"]];

        const forwardRel:XgenRelationship = {
            id:xmlRelationship.attributes["relationship-id"],
            text:xmlRelationship.attributes["text"],
            source,
            target,
            reverse:null
        };
        model.relationshipsById[forwardRel.id] = forwardRel;
        const reverseRel:XgenRelationship = {
            id:xmlRelationship.attributes["reverse-relationship-id"],
            text:xmlRelationship.attributes["reverse-text"] ?? "rev(" + forwardRel.text + ")",
            source:target,
            target:source,
            reverse:forwardRel
        };
        forwardRel.reverse = reverseRel;
        model.relationshipsById[reverseRel.id] = reverseRel;

        if (xmlRelationship.attributes["is-containment"] === "true") {
            target.containmentRel = forwardRel;
        }
    }

    return model;
}

