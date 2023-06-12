/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { useContext } from "preact/hooks";
import { localize } from "../Localizer";
import { ApplicationSession, SessionContext } from "../Session";

interface SessionManagerInterface {
    excludeDataActions: boolean;
}

export function SessionManager({ excludeDataActions }: SessionManagerInterface) {
    const applicationSession: ApplicationSession = useContext(SessionContext);

    const prettyPrint = (text: string): string => {
        const o = JSON.parse(text);
        return JSON.stringify(o, null, 4);
    }

    const loadSession = async () => {
        let input = document.createElement('input');
        input.type = 'file';
        input.onchange = async () => {
            let files: FileList = input.files;
            if (files.length > 0) {
                const jsonFile = files.item(0);
                let reader = new FileReader();
                reader.readAsText(jsonFile);
                reader.onload = async function () {
                    if (typeof reader.result === 'string') {
                        try {
                            const json: string = reader.result as string;
                            await applicationSession.loadSession(json);
                            applicationSession.refresh();
                        } catch (e) {
                            if (typeof e === "string") {
                                alert(e);
                            } else if (e instanceof Error) {
                                alert(e.message);
                            }
                        }
                    }
                };
                reader.onerror = function () {
                    alert(localize("Invalid file", [], false));
                };
            }
        };
        input.click();
    }

    const saveSession = async () => {
        const json = prettyPrint(applicationSession.getSessionState(excludeDataActions));
        const toText = (v: number):string => {return v < 10 ? "0" + v : v + ""}

        const url = URL.createObjectURL(new Blob([json], {type:'application/json'}));
        const today:Date = new Date();        
        const currentDate = toText(today.getFullYear()) + toText(today.getMonth() + 1) + toText(today.getDate());
        const currentTime = toText(today.getHours()) +toText(today.getMinutes()) + toText(today.getSeconds());

        let linkEl = document.createElement('a');
        linkEl.setAttribute("href", url);
        linkEl.setAttribute("download", "sessionState_" + currentDate + currentTime + ".json");
        linkEl.click();       
        URL.revokeObjectURL(url);
    }

    return <div>
        <button onClick={loadSession}>{localize("Load Session", [], false)}</button>
        &nbsp;
        <button onClick={saveSession}>{localize("Save Session", [], false)}</button>
    </div>
}