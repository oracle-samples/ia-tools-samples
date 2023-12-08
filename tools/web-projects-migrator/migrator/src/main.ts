/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import {readFileSync, readdirSync} from 'fs'
import { migrateExcelRuleDocument } from './ExcelMigrator';
import { FlowProject } from 'ia-public/Project'
import { migrateWordRuleDocument } from './WordMigrator';
import { newUID, StringUtil } from './Util'
import path from 'path'
import fs from 'fs'
import { logDocumentMigrationWarning, MigrationContext, MigrationSettings } from './MigratorCommon';
import {parse, ParseError, printParseErrorCode} from 'jsonc-parser'
import { arrayValidator, booleanValidator, enumValidator, lookupValidator, objectValidator, optionalValidator, stringValidator } from './Validator';
import { parseXml } from './Xml';

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

    if (!argProjectDir) {
        console.error("Migrates Oracle Intelligent Advisor projects (authored with Oracle Policy Modeling) to Flow projects.");
        console.error("");
        console.error(`Usage: migrate <project-directory> [--settings <settings.json>] [--template <flow.json>] [--outproject <project.json>] `);
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

    const flowProject:FlowProjectEx = argProjectTemplateFile ? JSON.parse(fs.readFileSync(argProjectTemplateFile, 'utf8')) : {
        version:2,
        scheme: "interview-scheme",
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
        rules:{}
    }

    // In case the template is a v1 template:
    if (flowProject.version === 1) {
        flowProject.version = 2;
        flowProject.documents = [];
    }

    if (flowProject.version !== 2) {
        console.error(`Template project version ${flowProject.version} is unsupported`);
        process.exit(1);
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
            while(flowProject.rules[ruleDocName]) {
                ruleDocName = ruleDocDefaultName + (++idx);
            }
            flowProject.rules[ruleDocName] = convertedDoc;
            flowProject.documents.push({
                name:ruleDocName,
                kind:"rules",
                description:""
            })
        }
    }

    if (argOutProjectFile) {
        fs.writeFileSync(argOutProjectFile, JSON.stringify(flowProject, null, "  "));
    } else {
        console.log(JSON.stringify(flowProject, null, "  "));
    }

    console.error("Done.");
})();
