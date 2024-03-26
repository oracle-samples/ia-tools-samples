/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import {readFileSync, readdirSync} from 'fs'
import { migrateExcelRuleDocument } from './ExcelMigrator';
import { DecisionServiceProject, DefaultRuleLanguageSettings, FlowProject, FlowSchemeProject } from 'ia-public/Project'
import { migrateWordRuleDocument } from './WordMigrator';
import { newUID, StringUtil } from './Util'
import path from 'path'
import fs from 'fs'
import { logDocumentMigrationWarning, MigrationContext, MigrationSettings } from './MigratorCommon';
import {parse, ParseError, printParseErrorCode} from 'jsonc-parser'
import { arrayValidator, booleanValidator, enumValidator, lookupValidator, objectValidator, optionalValidator, stringValidator } from './Validator';
import { XmlElement, parseXml } from './Xml';
import { migrateScreens } from './InterviewScreensMigrator';
import decompress from 'decompress-unzip';
import { DecompressFile } from 'decompress-unzip';
import { generateDecisionServiceContract } from './DecisionServiceContractHandler';

export interface ModelAttribute {
    type: string,
    text: string,
    entity: string,
    publicName?: string,
    hasValueList: boolean,
    seedableFromUrlParameter: boolean,
    hasInputDataMapping: boolean,
    hasOutputDataMapping: boolean
}

export interface ModelAttributes { [key: string]: ModelAttribute };

export interface ModelEntity { parent: string, publicName?: string, text: string, containmentRelationship: string, identifyingAttributeId: string, isInferred: boolean };
export interface ModelEntities { [key: string]: ModelEntity };

export interface ModelRelationship { source: string, target: string, publicName?: string, text: string, isContainment: boolean, type: string };
export interface ModelRelationships { [key: string]: ModelRelationship };

const supportedFlowVersion = 8;
const supportedSchemeVersion = 5;
const supportedDecisionServiceVersion = 7;

function enumerateFiles(startPath, cb:(name:string) => void) {
    function processDir(relativePath) {
        for(const file of readdirSync(path.join(startPath, relativePath), {withFileTypes:true})) {
            if (file.isFile()) {
                cb(path.join(relativePath, file.name));
            } else if (file.isDirectory()) {
                processDir(path.join(relativePath, file.name));
            }
        }
    }
    processDir("");
}

function readMigrationSettings(customSettingsFile:string):MigrationSettings {
    const settings:MigrationSettings = {
        attributeRename:{},
        collapseEntities:[],
        ruleDocumentFilter:{},
        language:{
            language:'en',
            formats:{
                argumentSeparator:',',
                dateFormat:'yyyy-mm-dd',
                decimalSeparator:'.',
                thousandsSeparator:','
            }
        }
    }

    if (customSettingsFile) {
        const errors:ParseError[] = [];
        const customSettings = parse(fs.readFileSync(customSettingsFile, 'utf8'), errors);
        for(const error of errors) {
            logDocumentMigrationWarning("Parse error in settings file.  " + printParseErrorCode(error.error) + " at position " + error.offset);
        }

        const validator = objectValidator({
            attributeRename:optionalValidator(lookupValidator(stringValidator)),
            collapseEntities:optionalValidator(arrayValidator(stringValidator)),
            keepConclusionLegends:optionalValidator(booleanValidator),
            ruleDocumentFilter:optionalValidator(lookupValidator(booleanValidator)),
            language:optionalValidator(objectValidator({
                language:enumValidator(['en', 'fr', 'es']),
                formats:objectValidator({
                    argumentSeparator:enumValidator([',', ';']),
                    dateFormat:enumValidator(['dd/mm/yyyy', 'd/m/yyyy', 'm/d/yyyy', 'yyyy-mm-dd']),
                    decimalSeparator:enumValidator(['.', ',']),
                    thousandsSeparator:enumValidator([',', '.', ' '])
                })
            })),
            flowControls:optionalValidator(objectValidator( {
                label:optionalValidator(stringValidator),
                screen:optionalValidator(stringValidator),
                container:optionalValidator(stringValidator),
                stage:optionalValidator(stringValidator),
                entityCollect:optionalValidator(stringValidator),
                entityContainer:optionalValidator(stringValidator),
                entityScreenGroup:optionalValidator(stringValidator),
                input:optionalValidator(objectValidator({
                    number:optionalValidator(objectValidator({
                        "radio-button":optionalValidator(stringValidator),
                        "text-button-group":optionalValidator(stringValidator),
                        "image-button-group":optionalValidator(stringValidator),
                        "text-image-button-group":optionalValidator(stringValidator),
                        "slider":optionalValidator(stringValidator),
                        "drop-down":optionalValidator(stringValidator),
                        "searching-combo":optionalValidator(stringValidator),
                        "listbox":optionalValidator(stringValidator),
                        "text":optionalValidator(stringValidator),
                        "custom":optionalValidator(stringValidator)
                    })),
                    date:optionalValidator(objectValidator({
                        "radio-button":optionalValidator(stringValidator),
                        "text-button-group":optionalValidator(stringValidator),
                        "image-button-group":optionalValidator(stringValidator),
                        "text-image-button-group":optionalValidator(stringValidator),
                        slider:optionalValidator(stringValidator),
                        calendar:optionalValidator(stringValidator),
                        "dmy-inputs":optionalValidator(stringValidator),
                        "datetime-text-group":optionalValidator(stringValidator),
                        "drop-down":optionalValidator(stringValidator),
                        "searching-combo":optionalValidator(stringValidator),
                        listbox:optionalValidator(stringValidator),
                        text:optionalValidator(stringValidator),
                        custom:optionalValidator(stringValidator),
                    })),
                    text:optionalValidator(objectValidator({
                        text:optionalValidator(stringValidator),
                        "radio-button":optionalValidator(stringValidator),
                        "text-button-group":optionalValidator(stringValidator),
                        "image-button-group":optionalValidator(stringValidator),
                        "text-image-button-group":optionalValidator(stringValidator),
                        slider:optionalValidator(stringValidator),
                        "drop-down":optionalValidator(stringValidator),
                        "searching-combo":optionalValidator(stringValidator),
                        listbox:optionalValidator(stringValidator),
                        "text-area":optionalValidator(stringValidator),
                        password:optionalValidator(stringValidator),
                        masked :optionalValidator(stringValidator),
                        custom:optionalValidator(stringValidator)
                    })),
                    boolean:optionalValidator(objectValidator({
                        "radio-button":optionalValidator(stringValidator),
                        "text-button-group":optionalValidator(stringValidator),
                        "image-button-group":optionalValidator(stringValidator),
                        "text-image-button-group":optionalValidator(stringValidator),
                        "drop-down":optionalValidator(stringValidator),
                        "searching-combo":optionalValidator(stringValidator),
                        listbox:optionalValidator(stringValidator),
                        checkbox:optionalValidator(stringValidator),
                        "image-button":optionalValidator(stringValidator),
                        switch:optionalValidator(stringValidator),
                        custom:optionalValidator(stringValidator)
                    })),
                    currency:optionalValidator(objectValidator({
                        "radio-button":optionalValidator(stringValidator),
                        "text-button-group":optionalValidator(stringValidator),
                        "image-button-group":optionalValidator(stringValidator),
                        "text-image-button-group":optionalValidator(stringValidator),
                        slider:optionalValidator(stringValidator),
                        "drop-down":optionalValidator(stringValidator),
                        "searching-combo":optionalValidator(stringValidator),
                        listbox:optionalValidator(stringValidator),
                        text:optionalValidator(stringValidator),
                        custom:optionalValidator(stringValidator)
                    }))
                })),
                referenceRelationship:optionalValidator(objectValidator({
                    toOne:optionalValidator(objectValidator({
                        text:optionalValidator(stringValidator),
                        "radio-button":optionalValidator(stringValidator),
                        "drop-down":optionalValidator(stringValidator),
                        "searching-combo":optionalValidator(stringValidator),
                        listbox:optionalValidator(stringValidator)

                    })),
                    toMany:optionalValidator(objectValidator({
                        checkbox:optionalValidator(stringValidator)
                    }))
                }))
            })),
            decisionServiceContract:optionalValidator(objectValidator({
                outputGoalAttributes:optionalValidator(booleanValidator),
                outputNonInputAttributesWithPublicNames:optionalValidator(booleanValidator)
            }))
        });
        try {
            validator("$settings", customSettings);
        } catch(error) {
            console.error("Error in settings: " + error);
            return null;
        }
        Object.assign(settings, customSettings);
    }

    return settings;
}

(async () => {
    // command line:
    //  - convert <project> --template <project.json> --settings <settings.json>

    let argProjectDir:string = null;
    let argRuleFilename:string = null;
    let argOutProjectFile:string = null;
    let argProjectTemplateFile:string = null;
    let argSettingsFile:string = null;
    let argSchemeFile:string = null;
    let argDecisionService:boolean = false;

    for(let i=2; i<process.argv.length; i++) {
        const nextArg = (name:string) => {
            if (i+1 >= process.argv.length) {
                console.error("Missing argument for " + name);
                process.exit(1);
            }
            return process.argv[++i];
        }

        const arg = process.argv[i];

        if (arg.startsWith('--')) {
            if (arg === "--doc") {
                argRuleFilename = nextArg("--doc");
            } else if (arg === "--outproject") {
                argOutProjectFile = nextArg("--outproject");
            } else if (arg === "--template") {
                argProjectTemplateFile = nextArg("--template");
            } else if (arg === "--settings") {
                argSettingsFile = nextArg("--settings");
            } else if (arg === "--scheme") {
                argSchemeFile = nextArg("--scheme");
            } else if (arg === "--decision-service") {
                argDecisionService = true;
            } else {
                console.error("Unknown option " + arg);
                process.exit(1);
            }

        } else if (!argProjectDir) {
            argProjectDir = arg;

        } else {
            console.error("Too many args");
            process.exit(1);
        }
    }

    if (!argProjectDir || (!argDecisionService && !argSchemeFile)) {
        console.error("Migrates Oracle Intelligent Advisor projects (authored with Oracle Policy Modeling) to Flow or Decision Service projects.");
        console.error("");
        console.error(`Usage: migrate <project-directory> --scheme <flow-scheme.json> [--settings <settings.json>] [--template <flow.json>] [--outproject <project.json>]  or  migrate <project-directory> --decision-service [--template <flow.json>] [--outproject <project.json>]`);
        process.exit(1);
    }

    const settings = readMigrationSettings(argSettingsFile);
    if (!settings) {
        process.exit(1);
    }
    const ruleFilenames:string[] = [];
    if (argRuleFilename) {
        ruleFilenames.push(argRuleFilename);
    } else {
        enumerateFiles(path.join(argProjectDir, "rules"), ruleFilename => {
            if (ruleFilename.indexOf("~$") < 0 && (StringUtil.endsWithNC(ruleFilename, ".docx") || StringUtil.endsWithNC(ruleFilename, ".xlsx"))) {
                const forwardSlashName = ruleFilename.replace(/\\/g, '/');
                ruleFilenames.push(forwardSlashName);
            }
        })
    }
    interface ProjectDocument {
        kind:"flow" | "rules",
        name:string;
        description:string;
    }
    interface FlowProjectEx extends FlowProject {
        documents:ProjectDocument[];
    }

    let migratedProject : FlowProjectEx | DecisionServiceProject

    if (argProjectTemplateFile) {
        migratedProject = JSON.parse(fs.readFileSync(argProjectTemplateFile, 'utf8'));
    } else {
        if (argDecisionService) {
            migratedProject = {
                version: supportedDecisionServiceVersion,
                inputContract: {},
                outputContract: {},
                rules: {},
                ruleLanguage: DefaultRuleLanguageSettings,
                documents: [],
                references: {
                    uid: newUID(),
                    items: []
                }
            }
        } else {
            let schemeName = path.basename(argSchemeFile).replace(".json", "");

            migratedProject = {
                version:supportedFlowVersion,
                scheme: schemeName,
                flow:{
                    kind: "section",
                    text: "Main section",
                    uid: newUID(),
                    schemeId: "",
                    goals: [],
                    schemeDataMapping: {
                        uid: newUID(),
                        $currentDate: "the current date"
                    } as any,
                    rows: []
                },
                documents: [],
                rules:{},
                references: {
                    uid: newUID(),
                    items: []
                }
            }
        }
    }

    if (argDecisionService && migratedProject.version !== supportedDecisionServiceVersion) {
        console.error(`Template decision service project version ${migratedProject.version} is unsupported. Please import then re-export the template using the Intelligent Advisor Hub.`);
        process.exit(1);
    } else if (!argDecisionService && migratedProject.version !== supportedFlowVersion) {
        console.error(`Template flow project version ${migratedProject.version} is unsupported. Please import then re-export the template using the Intelligent Advisor Hub.`);
        process.exit(1);
    }
    let scheme:FlowSchemeProject;

    if (!argDecisionService) {
        scheme = JSON.parse(fs.readFileSync(argSchemeFile, 'utf8'));

        if (scheme.version !== supportedSchemeVersion) {
            console.error(`Flow scheme version ${scheme.version} is unsupported. Please import then re-export the Flow scheme using the Intelligent Advisor Hub.`);
            process.exit(1); 
        }
    }

    const migrationContext = new MigrationContext(settings);

    async function migrateRuleDocFile(projectDir:string, ruleFilename:string) {
        const officeBlob = readFileSync(path.join(projectDir, "rules", ruleFilename));
        const xgenBlob = readFileSync(path.join(projectDir, "bin", ruleFilename + ".xgen"));
        const xgen = parseXml(xgenBlob.toString());

        // If the xgen contains errors then it won't contain any compiled rules and this document won't have any migrated content
        if (xgen.selectFirst("root/errors/error")) {
            logDocumentMigrationWarning("Document has validation errors and can't be migrated. Fix validation errors in OPM and try again.");
            return null;
        }

        if (StringUtil.endsWithNC(ruleFilename, ".docx")) {
            return await migrateWordRuleDocument(officeBlob, xgen, migrationContext);
        } else if (StringUtil.endsWithNC(ruleFilename, ".xlsx")) {
            return await migrateExcelRuleDocument(officeBlob, xgen, migrationContext);
        } else {
            throw "unknown document type"
        }
    }

    for(const ruleFilename of ruleFilenames) {
        let includeDocument = true;
        for(const pattern in settings.ruleDocumentFilter) {
            if (new RegExp(pattern, "i").test(ruleFilename)) {
                includeDocument = settings.ruleDocumentFilter[pattern];
                break;
            }
        }
        if (!includeDocument) {
            console.error("Skipped " + ruleFilename);
            continue;
        }

        console.error("Converting " + ruleFilename);
        
        const convertedDoc = await migrateRuleDocFile(argProjectDir, ruleFilename);
        if (convertedDoc) {
            const ruleDocDefaultName = ruleFilename.substring(0, ruleFilename.length-5)   // remove the ".docx" or ".xlsx"
            let idx = 1, ruleDocName = ruleDocDefaultName;
            while(migratedProject.rules[ruleDocName]) {
                ruleDocName = ruleDocDefaultName + (++idx);
            }
            migratedProject.rules[ruleDocName] = convertedDoc;

            if (!migratedProject.documents) {
                migratedProject.documents = [];
            }

            migratedProject.documents.push({
                name:ruleDocName,
                kind:"rules",
                description:""
            })
        }
    }

    let rulebaseXmlAttributeTypes : {[key: string] : string} = null;

    async function findAttributeTypeInRulebaseXml(attributeName: string) : Promise<string> {
        if (rulebaseXmlAttributeTypes === null) {
            const zipName = fs.readdirSync(argProjectDir + "/output").filter(name => name.endsWith(".zip"))[0];
            const rulebaseXmlBuffer = fs.readFileSync(argProjectDir + "/output/" + zipName);
            let rulebaseXml;
            let unzippedFiles: DecompressFile[] = await decompress()(rulebaseXmlBuffer);
            for (let file of unzippedFiles) {
                if (file.path === "rulebase.xml") {
                    rulebaseXml = parseXml(file.data.toString());
                }
            }

            rulebaseXmlAttributeTypes = {}

            for (const attributeEl of rulebaseXml.select("rulebase/entity/attribute").elements) {
                let name: string = attributeEl.attributes["name"];
                let type: string = attributeEl.attributes["type"]
                rulebaseXmlAttributeTypes[name] = type.toLowerCase();
            }
        }

        return rulebaseXmlAttributeTypes[attributeName];
    } 

    // Extract data model for use by flow screen migrator
    let attributeDetails : ModelAttributes = {};
    let projectDataModelXml:XmlElement = parseXml(fs.readFileSync(argProjectDir + "/projectDataModel.xml", 'utf8'));

    let entityDetails : ModelEntities = {};
    let relationshipDetails : ModelRelationships = {};

    let publicNameToAttributeId : {[key: string] : string} = {};

    for (const entityEl of projectDataModelXml.select("root/entities/entity").elements) {
        if (entityEl.attributes["ref"] && entityEl.attributes["ref"] === "global") {
            entityDetails["global"] = {parent:null, text:"global", publicName:null, containmentRelationship:null, identifyingAttributeId:null, isInferred:false};
        } else {
            let id = entityEl.attributes["id"];
            let text = entityEl.attributes["name"];
            let parent = entityEl.attributes["containment-parent-id"];
            let containmentRelationship = entityEl.attributes["containment-relationship-id"];
            let identifyingAttributeId = entityEl.attributes["identifying-attribute-name"];
            let isInferred:boolean = migrationContext.isInferredEntity(text);

            let publicName;
            if ("public-id" in entityEl.attributes && !StringUtil.isAllWhitespace(entityEl.attributes["public-id"])) {
                publicName = entityEl.attributes["public-id"];
            }

            entityDetails[id] = {parent: parent, text: text, publicName: publicName, containmentRelationship: containmentRelationship, identifyingAttributeId: identifyingAttributeId, isInferred: isInferred};
        }

        for (const attributeEl of entityEl.select("attribute").elements) {
            let name: string = attributeEl.attributes["name"];
            let text: string = migrationContext.migrateAttributeText(attributeEl.selectFirst("text/base").text());
            let type: string = attributeEl.attributes["type"];

            let publicName;
            if ("public-name" in attributeEl.attributes && !StringUtil.isAllWhitespace(attributeEl.attributes["public-name"])) {
                publicName = attributeEl.attributes["public-name"];
                publicNameToAttributeId[publicName] = name;
            }

            if (type === "auto") {
                if ("public-name" in attributeEl.attributes) {
                    type = await findAttributeTypeInRulebaseXml(attributeEl.attributes["public-name"]);
                } else {
                    type = await findAttributeTypeInRulebaseXml(name);
                }
            } 

            let seedableFromUrlParameter: boolean = false;
            if ("seedable" in entityEl.attributes) {
                seedableFromUrlParameter = true;
            }

            let hasInputDataMapping: boolean = attributeEl.selectFirst("bound-input") ? true : false;
            let hasOutputDataMapping: boolean = attributeEl.selectFirst("bound-output") ? true : false;


            let entity: string = entityEl.attributes["id"];
            let hasValueList: boolean = attributeEl.selectFirst("enumeration-list") !== null;
            attributeDetails[name] = {
                type: type,
                text: text,
                publicName: publicName,
                entity: entity,
                hasValueList: hasValueList,
                seedableFromUrlParameter: seedableFromUrlParameter,
                hasInputDataMapping: hasInputDataMapping,
                hasOutputDataMapping: hasOutputDataMapping
            };
        }
    }

    for (const el of projectDataModelXml.select("root/relationships/relationship").elements) {
        let id: string = el.attributes["relationship-id"];
        let source: string = el.attributes["source"];
        let target: string = el.attributes["target"];
        let text: string = migrationContext.migrateAttributeText(el.attributes["text"]);
        let type: string = el.attributes["type"];
        let isContainment: boolean = el.attributes["is-containment"] === "true";

        let publicName;
        if ("public-id" in el.attributes && !StringUtil.isAllWhitespace(el.attributes["public-id"])) {
            publicName = el.attributes["public-id"];
        }

        relationshipDetails[id] = {source:source, target:target, text:text, publicName: publicName, isContainment:isContainment, type:type};
    }

    let interviewModelXml:XmlElement = parseXml(fs.readFileSync(argProjectDir + "/Interview.xint", 'utf8'));

    
    if (argDecisionService) {
        generateDecisionServiceContract(interviewModelXml, migratedProject as DecisionServiceProject, attributeDetails, entityDetails, settings)
    } else {
        // Migrate interview screens
        migrateScreens(interviewModelXml, migratedProject as FlowProjectEx, scheme, attributeDetails, entityDetails, relationshipDetails, publicNameToAttributeId, settings);
    }

    if (argOutProjectFile) {
        fs.writeFileSync(argOutProjectFile, JSON.stringify(migratedProject, null, "  "));
    } else {
        console.log(JSON.stringify(migratedProject, null, "  "));
    }

    console.error("Done.");
})();
