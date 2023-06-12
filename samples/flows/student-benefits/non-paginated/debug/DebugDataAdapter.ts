/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IASentDataObject } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { logger } from "../src/Application";
import { studentBenefits_GetStudentHandler } from "./StudentBenefitsTransactionHandler";

export interface TransactionHandler {
    actionSchemeID: string;
    handleTransaction: (inputData: IASentDataObject, resultDefinition: any) => object | null;
}

const transactionHandlers: TransactionHandler[] = [];

export function addTransactionHandler(handler: TransactionHandler) {
    if (transactionHandlers.some(h => h.actionSchemeID === handler.actionSchemeID)) {
        throw new Error(`Handler for ${handler.actionSchemeID} already added`);
    }
    transactionHandlers.push(handler);
}

export function debugTransact(schemeId: string, inputData: IASentDataObject, resultDefinition: any) {
    const handler = transactionHandlers.find(h => h.actionSchemeID === schemeId);
    if (handler) {
        return handler.handleTransaction(inputData, resultDefinition);
    } else {
        logger.error(`Unkown schemeId/action "${schemeId}"`);
        return {};
    }
}


addTransactionHandler(studentBenefits_GetStudentHandler);