export type ContractFieldType = "array" | "string" | "object" | "number" | "boolean" | "date";

export interface ContractField {
    uid: string;
    name: string;
    type: ContractFieldType;
    value: string;
    constraint?: ContractFieldConstraint;
    properties?: ContractField[];
}

export interface ContractFieldConstraint {
    optional?: boolean;
    minimum?: string;
    maximum?: string;
    pattern?: string;
}

export interface ContractFields {
    properties?: ContractField[]
}

export interface ContractDefinition {
    input: ContractFields;
    output: ContractFields;
}
