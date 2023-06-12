export type RuleDocumentContent = RuleComment | RuleBlock ;

export type RuleBlockContent = RuleLine | RuleTable;

export type RuleDocument = RuleDocumentContent[];

/** Text that lives outside the active rules */
export interface RuleComment {
    type?:'comment';    // default content type
    style:'normal'|'heading1'|'heading2'|'heading3'|'heading4';
    text:string;
}

export interface RuleBlock {
    type:'rule-block',
    object?:string;
    lines:RuleBlockContent[];
}

/** Text within the active rule block */
export interface RuleLine {
    type?:'active'|'comment'|'inactive';    // 'active' will be the default
    level:number;
    text:string;
}

export type TableCell = string | null | RuleLine | RuleLine[];

export interface RuleTable {
    type:'table';
    columns:TableColumn[];
    rows:TableCell[][];
}

export interface TableColumn {
    text?:string;
    type:'identifier' | 'condition' | 'conclusion';
}
