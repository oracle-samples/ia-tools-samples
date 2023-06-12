/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IACustomDataAction } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { StateUpdater, useContext, useState } from "preact/hooks";
import { dataAdapter, logger } from "../Application";
import { ApplicationSession, SessionContext } from "../Session";

function deepEquals(ob1, ob2) {
    if (Object.is(ob1, ob2)) {
        return true;
    }
    if (ob1 == null || ob2 == null || typeof ob1 !== "object" || typeof ob2 !== "object" || Object.keys(ob1).length !== Object.keys(ob2).length) {
        return false;
    }
    for (const name of Object.keys(ob1)) {
        if (!deepEquals(ob1[name], ob2[name])) {
            return false;
        }
    }
    return true;
}

interface CacheItem {
    controlId: string;
    time: Date;
    inputValue: any;
    result: object;
}

class TransactionCache {
    lastControlValue: [string, any][] = [];
    items: CacheItem[] = [];

    setCache(controlId: string, inputValue: any, result: object) {
        const existing = this.getCache(controlId, inputValue);
        if (existing) {
            existing.result = result;
            existing.time = new Date();
        } else {
            this.items.push({
                controlId: controlId,
                time: new Date(),
                inputValue: inputValue,
                result: result
            });
        }
        this.lastControlValue[controlId] = inputValue;
    }

    /** If the data action hasn't made a transaction before, or if it has but the data that
     *  gets sent (the input data) has changed since the last time the action was triggered,
     *  this will return true */
    inputHasChanged(controlId: string, currentInputValue: any) {
        if (!this.lastControlValue.hasOwnProperty(controlId)) {
            return true;
        }
        return !deepEquals(currentInputValue, this.lastControlValue[controlId]);
    }

    hasCache(controlId: string, currentInputValue: any) {
        return this.items.findIndex(i => i.controlId === controlId && deepEquals(currentInputValue, i.inputValue)) > -1;
    }
    getCache(controlId: string, currentInputValue: any) {
        return this.items.find(i => i.controlId === controlId && deepEquals(currentInputValue, i.inputValue)) ?? null;
    }
}

/** Note: some data transactions which only load data could be handled asynchronously for the best user experience,
 *  but in your implementation be aware of accessing and setting data in the cache in a thread-safe manner.
 *  (This example code does not demonstrate asynchronous and thread-safe custom data actions) */
export function handleDataTransaction(dataActionCtrl: IACustomDataAction) {
    const session: ApplicationSession = useContext(SessionContext);
    const state = session.getState();

    const [cache, _setCache]: [TransactionCache, StateUpdater<TransactionCache>] = useState(new TransactionCache());

    if (cache.inputHasChanged(dataActionCtrl.id, dataActionCtrl.sentData)) {
        logger.log(`Handling custom data action "${dataActionCtrl.schemeId}" on page "${state.currentPage.text}"`);
        if (!dataActionCtrl.sentData) {
            logger.log("No data associated with the data action is known");
        }

        let result;
        if (cache.hasCache(dataActionCtrl.id, dataActionCtrl.sentData)) {
            result = cache.getCache(dataActionCtrl.id, dataActionCtrl.sentData).result;
        } else {
            result = dataAdapter.transact(dataActionCtrl.schemeId, dataActionCtrl.sentData, dataActionCtrl.returnedDataDefinition);
        }

        cache.setCache(dataActionCtrl.id, dataActionCtrl.sentData, result);
        dataActionCtrl.setReturnedData(result);

        session.inputChanged(dataActionCtrl.id);
    }
}