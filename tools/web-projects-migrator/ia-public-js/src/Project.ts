import { FlowSection } from './FlowModel';
import { RuleDocument } from './RuleDocument'
import {ContractFields} from './Contract';
import { FlowSchemeIcon, LocalisationStrings, SchemeConnectionObject, SchemeDefaultFormatters, SchemeFormatter, SchemeObjectSchema, SchemePaletteGroup } from './FlowSchemeModel';

export type ProjectRules = {
    [name:string]: RuleDocument;
};

export type Project = DecisionServiceProject | FlowProject | FlowSchemeProject;

export interface RuleLanguageSettings {
    language:string;
    formats:RuleFormatSettings;
}

export type RuleDateFormat =  'dd/mm/yyyy' | 'd/m/yyyy' | 'm/d/yyyy' | 'yyyy-mm-dd';

export interface RuleFormatSettings {
    decimalSeparator:'.' | ',';
    thousandsSeparator:',' | '.' | ' ';
    argumentSeparator:',' | ';';
    dateFormat:RuleDateFormat;
}

/** Equivalent settings to match what all projects used before language settings were introduced */
export const DefaultRuleLanguageSettings:RuleLanguageSettings = {
    language:'en',
    formats:{ decimalSeparator:'.', thousandsSeparator:',', argumentSeparator:',', dateFormat:'yyyy-mm-dd' }
}

export function getRuleLanguageSettings(project: DecisionServiceProject | FlowSchemeProject):RuleLanguageSettings {
    if (!project) {
        return DefaultRuleLanguageSettings;
    } else {
        return project.ruleLanguage ?? DefaultRuleLanguageSettings;
    }
}

export type ProjectReference = DecisionServiceReference;

export interface DecisionServiceReference {
    uid: string;
    kind: "decisionService",
    name: string;
    modelObjectPath: string;
    deployment: string;
    isProject?: boolean;
    inputMapping: any;
    outputMapping: any;
}

export interface DecisionServiceProject {
    /**
     * version 1: Initial version (version property is absent)
     * version 2: Optional input fields
     * version 3: Rule language
     * version 4: User Set Data
     * version 5: Multiple rule documents
     * version 6: Decision service references
     * version 7: Decision service reference changes
     */
    version?: number;

    /** Only these inputs will be allowed */
    inputContract: ContractFields;

    /** These outputs must be supplied */
    outputContract: ContractFields;

    /** Any number of named rule documents.  There's no folders, encode that in the document name if you want that */
    rules: ProjectRules

    /** Should only be absent when version < 3, and then the DefaultRuleLanguageSettings are used.  */
    ruleLanguage?: RuleLanguageSettings;

    /** Additional document properties, added in version 5 */
    documents?: ProjectDocumentProperties[];

    /**
     * External references such to other dependencies such as decision services, added in version 6.
     */
    references?: ProjectReferences;
}

export interface ProjectReferences {
    uid: string,
    items: ProjectReference[];
}

export type ProjectDocumentKind = "flow" | "rules";

export interface ProjectDocumentProperties {
    kind: ProjectDocumentKind;
    name: string;
    description: string;
}

export interface FlowProject {
    "$ref"?: string;

    /**
     * version 1: Initial version
     * version 2: Added documents
     * version 3: Rule language
     * version 4: Resizing data action on a screen
     * version 6: additional properties for data controls
     * version 7: Decision service references
     * version 8: Decision service reference changes
     */
    version: number;

    /** Any number of named rule documents.  There's no folders, encode that in the document name if you want that */
    rules: ProjectRules;

    flow: FlowSection;
    scheme: string;

    /**
     * External references such to other dependencies such as decision services, added in version 5.
     */
    references?: ProjectReferences;

    /** Additional document properties, added in version 2 */
    documents?: ProjectDocumentProperties[];
}

export interface FlowSchemeProject {
    /**
     * version 1: Initial version (version property is absent)
     * version 2: ruleLanguage
     * version 3: restructured mapping
     * version 4: additional properties for data controls
    */
    kind: "flowScheme";
    version: number,
    runtime: string;
    icon?: FlowSchemeIcon;
    debugURL?: string;
    palette: SchemePaletteGroup[];
    formatters: SchemeFormatter[];
    defaultFormatters: SchemeDefaultFormatters;
    localisationStrings: LocalisationStrings;
    inputSchema?: SchemeObjectSchema;
    connectionObjects?: SchemeConnectionObject[];
    ruleLanguage?: RuleLanguageSettings;
}
