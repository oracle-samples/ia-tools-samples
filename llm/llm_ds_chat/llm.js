/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { tools } from "./tools.js";

const openAIEndpoint = "https://api.openai.com/v1/chat/completions";
const apiKey = "<YOUROPENAIKEY>"
const model = "gpt-4-1106-preview";

let messages = [{
    role: "system",
    content: `You are helping human contact center agents respond to enquiries from taxpayers.` +
             `Each tool provided to you will often return an answer even if not all the parameters are known. So only ask the user to provide the required parameters to start with.` +
             `If a tool returns the null value, you should ask the user to provide information for one or more of the other parameters.`
}];

export async function addUserMessage(content) {
    messages.push({
        role: "user",
        content
    });
    const message = await invokeLLM();

    messages.push(message);
    return message;
}

export async function addToolResult(tool_call_id, result) {
    messages.push({
        role: "tool",
        tool_call_id,
        content: JSON.stringify(result)
    });
    const message = await invokeLLM();

    messages.push(message);
    return message;

}

async function invokeLLM() {
    const apiRequest = {
        model,
        messages,
        tools
    }

    const req = await fetch(openAIEndpoint, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify(apiRequest)
    });

    if (req.status != 200) {
        throw new Error("llm failed");
    }

    const json = await req.json();
    return json.choices[0].message;
    
}