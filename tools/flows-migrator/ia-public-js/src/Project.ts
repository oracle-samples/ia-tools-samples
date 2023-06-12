import { FlowSection } from './FlowModel';
import { RuleDocument } from './RuleDocument'
import { ContractFields } from './Contract';
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
        return 'ruleLanguage' in project ? project.ruleLanguage : DefaultRuleLanguageSettings;
    }
}

export interface DecisionServiceProject {
    /**
     * version 1: Initial version (version property is absent)
     * version 2: Optional input fields
     * version 3: Rule language
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
     */
    version: number;

    /** Any number of named rule documents.  There's no folders, encode that in the document name if you want that */
    rules: ProjectRules;

    flow: FlowSection;
    scheme: string;

    /** Additional document properties, added in version 2 */
    documents?: ProjectDocumentProperties[];
}

export interface FlowSchemeProject {
    /**
     * version 1: Initial version (version property is absent)
     * version 2: ruleLanguage
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
