/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { render } from "preact";
import { useState } from "preact/hooks";
import { startSession } from "../src";
import { dataAdapter, logger } from "../src/Application";
import { debugTransact } from "./DebugDataAdapter";
import { exampleGlobalDataSets } from "./ExampleGlobalData";

/* This file is only compiled in a debug build of this project, it's purpose is to render a configuration page
 * where you can easily fill out the details of a Flow project or deployment and render it locally for debugging
 * or demonstration purposes.
 * Using this avoids the need for other tools to build the requests to acquire the bearer token and JWT for
 * specific Flow projects, but is only built in webpack's debug configuration because none of these operations
 * should ever be done client-side in a production environment. */


// overwrite the non-functional logger functions so that we can see helpful debug messages in the browser's console
logger.log = (msg, isError = false) => {
    if (isError) {
        console.error(msg);
    } else {
        console.log(msg);
    }
}
logger.error = (msg) => logger.log(msg, true);

// overwrite the (non-functional) production dataAdapter's transact with the debug adapter's transact
dataAdapter.transact = debugTransact;

/* If the URL parameter _iajwt is present we can immediately delegate to the startSession function, otherwise
 * render the various inputs to collect the relevant information needed to acquire both a bearer token and
 * a JWT to start a Flow */
const url = new URL(window.location.href);
if (url.searchParams.get("_iajwt")) {
    startSession;
} else {
    render(<FlowDetailsForms/>, document.body);
}

function authUrl(hubURL: string, apiVersion: string) {
    return hubURL + "/api/" + apiVersion + "/auth"
}

async function getBearerToken(hubURL: string, apiVersion: string, client: string, secret: string) {
    const url = authUrl(hubURL, apiVersion);
    let tokenRequest;
    try {
        tokenRequest = await fetch(url, {
            method: "POST",
            body: `grant_type=client_credentials&client_id=${encodeURIComponent(client)}&client_secret=${encodeURIComponent(secret)}`,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        })
    } catch {
        throw new Error("Failed to fetch. Check console to see whether this was a CORS issue, or the URL couldn't be reached.");
    }
    
    const tokenJSON = await tokenRequest.json();
    if (tokenJSON.access_token) {
        return tokenJSON.access_token;
    } else if (tokenJSON.detail) {
        if (tokenJSON.detail === "Login failed") {
            throw new Error("Login failed: check API Client credentials, and if the client is enabled")
        }
        throw new Error(tokenJSON.detail);
    }
    throw new Error("Unknown JSON response!");
}

async function getJWT(wdUrl, bearerToken: string, action: string, flow: string, flowVersion?: string | number) {
    const url = wdUrl + "/flow/start";
    const body = {
        action: "debug"
    };
    body[action === "debug" ? "project" : "deployment"] = flow;
    if (flowVersion) {
        body["version"] = flowVersion;
    }

    let jwtRequest;
    try {
        jwtRequest = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: "Bearer " + bearerToken
            },
            body: JSON.stringify(body)
        });
    } catch {
        throw new Error("Failed to fetch. Check console to see whether this was a CORS issue, or the URL couldn't be reached.");
    }

    const json = await jwtRequest.json();
    if (json.jwt) {
        return json.jwt;
    } else if (json.type === 'error') {
        throw new Error(json.message);
    }
    throw new Error("Unknown JSON response!");
}

interface InputProperties {
    id: string;
    text: string;
    value: string;
    valueUpdate: (value) => void;
    type?: string;
    hidden?: boolean;
    size?: number;
    labelAbove?: boolean;
}
function Input(props: InputProperties) {
    return props.hidden ? null : <div style={"display:flex;margin-bottom:1px;" + (props.labelAbove ? "flex-direction:column" : "justify-content:flex-end")}>
        <label for={props.id} style={"margin-right:auto"}>{props.text}:</label><input id={props.id} type={props.type ?? "text"} value={props.value} required={true} disabled={false} onInput={e => props.valueUpdate((e.target as HTMLInputElement).value)} size={props.size}></input>
    </div>
}

interface DropdownProperties {
    id: string;
    text: string;
    items: {id: string, text: string}[];
    valueUpdate: (value) => void;
    disabled?: boolean;
}
function Dropdown(props: DropdownProperties) {
    return <div style={"display:flex;justify-content:flex-end;margin-bottom:1px"}>
        <label for={props.id} style={"margin-right:auto"}>{props.text}:</label>
        <select id={props.id} type="" required={true} disabled={props.disabled} onChange={e => props.valueUpdate(props.items[(e.target as HTMLSelectElement).selectedIndex].id)}>
            {props.items.map(item => <option id={item.id}>{item.text}</option>)}
        </select>
    </div>
}

function FlowDetailsForms() {
    // State hooks for collecting and displaying information relevant to get a Bearer token
    const [hubURL, setHubURL] = useState("http://localhost:8080/opa-hub");
    const [apiVersion, setApiVerison] = useState("12.2.23");
    const [clientId, setClientId] = useState("apiuser");
    const [clientSecret, setClientSecret] = useState(null);
    const [bearerStatus, setBearerStatus] = useState(null);
    const [bearerToken, setBearerToken] = useState(null);
    
    // State hooks for collecting information relevant to get a Flow JWT (as well as the
    // acquired Bearer token above)
    const [wdURL, setWdURL] = useState(null);
    const [action, setAction] = useState("debug");
    const [flow, setFlow] = useState(null);
    const [projectVersion, setProjectVersion] = useState("draftOrLatest");
    const [jwtStatus, setJwtStatus] = useState(null);
    const [jwt, setJwt] = useState(null);

    const dataSetNames = exampleGlobalDataSets.map(s => s.name);
    const [globalDataSetJson, _setGlobalDataJson] = useState(null);
    const [selectedDataSetBase64, _setSelectedDataSetBase64] = useState(null);
    const setGlobalDataSet = (name: string) => {
        if (!name) {
            _setGlobalDataJson(null);
            _setSelectedDataSetBase64(null);
            return;
        }

        const json = exampleGlobalDataSets.find(s => s.name === name).data;
        const jsonString = JSON.stringify(json, null, 4);
        _setGlobalDataJson(jsonString);
        _setSelectedDataSetBase64(btoa(jsonString));
    }


    /* This function ensures all the details of the Hub and the API Client are provided,
     * then makes a request to acquire an Bearer Token for use in the next form to get
     * authorization to start a Flow */
    function login(): void {
        if (hubURL && apiVersion && clientId && clientSecret) {
            setBearerToken(null);
            if (jwt !== null) {
                setJwt(null);
                setJwtStatus("JWT was cleared");
            }
            setBearerStatus("Getting bearer token");
            getBearerToken(hubURL, apiVersion, clientId, clientSecret)
                    .then(token => {
                        setBearerToken(token);
                        setBearerStatus("Logged into: " + authUrl(hubURL, apiVersion));
                        if (wdURL === null) {
                            setWdURL(hubURL.substring(0, hubURL.indexOf("/opa-hub", 9)) + "/web-determinations")
                        }
                    })
                    .catch(ex => setBearerStatus(ex.message));
        }
    }

    function parseVersion(projectVersion: string): string | number {
        if (!projectVersion) {
            return null;
        }
        if (projectVersion === "latest" || projectVersion === "draftOrLatest") {
            return projectVersion;
        }
        if (/^[0-9]*$/.test(projectVersion)) {
            const val =  Number.parseInt(projectVersion);
            if (val > 0) {
                return val;
            }
        }
        return null;
    }

    function getFlowAuthorization(): void {
        if (action && flow) {
            let version;
            if (action === "debug") {
                version = parseVersion(projectVersion);
                if (version === null) {
                    setJwtStatus("Project version must be 'draftOrLatest', 'latest', or an integer >= 1");
                    return;
                }
            }
            setJwtStatus("Getting JWT...");
            getJWT(wdURL, bearerToken, action, flow, version)
                    .then(jwt => {
                        setJwt(jwt);
                        setJwtStatus(null);
                    })
                    .catch(ex => setJwtStatus(ex.message));
        }
    }

    function setFlowAndClearJWT(value): void {
        setFlow(value);
        setJwt(null);
        setJwtStatus(null);
    }

    return <div>
        <form onSubmit={e => e.preventDefault()} style={"padding-bottom:20px;display:inline-block"} disabled={bearerToken}>
            <strong>Get a bearer token</strong><br/>
            <Input text="Hub URL" id="hub" value={hubURL} valueUpdate={setHubURL} size={40} labelAbove={true}></Input>
            <Input text="API version" id="apiversion" value={apiVersion} valueUpdate={setApiVerison}></Input>
            <Input text="Client ID" id="client" value={clientId} valueUpdate={setClientId}></Input>
            <Input text="Client secret" id="secret" type="password" value={clientSecret} valueUpdate={setClientSecret}/>
            
            <input type="submit" onClick={login} value="Log in"></input>
        </form>
        <div>
            {bearerStatus !== null ? <>{bearerStatus}<br/></> : null}
            {bearerToken !== null ? <>Bearer token:<br/><textarea readonly={true} rows={10} style={"display:inline;width:350px"}>{bearerToken}</textarea></> : null}
        </div>

        <form onSubmit={e => e.preventDefault()} style={"padding:20px 0;display:" + (bearerToken ? "inline-block" : "none")} disabled={bearerToken}>
            <strong>Use the bearer token to start a flow action</strong><br/>
            <Input text="Web-determinations URL" id="wd" value={wdURL} valueUpdate={setWdURL} size={40} labelAbove={true}></Input>
            <Dropdown id="_action" text="Action" items={[{id:"debug", text:"debug"}, {id:"startOrResume", text:"startOrResume"}]} valueUpdate={setAction}/>

            {/* the action startOrResume can only target deployed Flow projects (so a Deployment), otherwise debug can only target a Project (which may or may not also be deployed) */}
            <Input text={action === "debug" ? "Project" : "Deployment"} id="flow" value={flow} valueUpdate={setFlowAndClearJWT}></Input>
            <Input hidden={action === "startOrResume"} text="Project version" id="projectversion" value={projectVersion} valueUpdate={setProjectVersion}></Input>

            <input type="submit" onClick={getFlowAuthorization} value="Get JWT"></input>
        </form>
        <div>
            {jwtStatus !== null ? <>{jwtStatus}<br/></> : null}
            {jwt !== null ? <>JWT:<br/><textarea readonly={true} rows={10} style={"display:inline;width:350px"}>{jwt}</textarea></> : null}
        </div>

        <div style={"padding:20px 0;display:" + (jwt ? "inline-block" : "none")}>
            <Dropdown id="_globalInputData" text="Global input data" items={[{id: null, text: "- none -"}, ...dataSetNames.map(name => { return { id: name, text: name } })]} valueUpdate={setGlobalDataSet} />
            <textarea readonly={true} rows={30} style={"width:350px"} hidden={!globalDataSetJson}>{globalDataSetJson}</textarea>
        </div>

        {/* The JWT contains the URL to begin the Flow, the next submit button will open a new tab to render the
        Flow in (which you'll see at the top of this file will use the startSession function of index.tsx) */}
        <form hidden={!jwt} method="GET" target="_blank">
            <input hidden={true} name="_iajwt" value={jwt}></input>
            <input hidden={true} name="_globalDataBase64" value={selectedDataSetBase64}></input>
            <input hidden={true} name="_debugger" value={action === 'debug' ? 'true' : 'false'}></input>
            <input type="submit" value={`Start '${flow}' flow`}> </input>
        </form>
    </div>
}