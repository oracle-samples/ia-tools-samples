/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
const sampleLocalizationData = {
    "What is your name?": "Quel est ton nom?",
    "Hello {0}!": "Bonjour {0}!",
    "This value is mandatory.": "Cette valeur est obligatoire.",
    "Why are you seeking compensation for this flight?": "Pourquoi souhaitez-vous une indemnisation pour ce vol?",
    "My flight was cancelled": "Mon vol a été annulé",
    "My flight was delayed": "Mon vol a été retardé",
    "My seat was downgraded": "Mon siège a été déclassé",
    "I was denied boarding": "On m'a refusé l'embarquement",
    "Other": "Autre",
}

const applySampleLocalizer = false;

function encode(str: string, forHTML: boolean) {
    const text = "" + str;
    if (forHTML)
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, "<br>");
    return text;
}

export function localize(key: string, params: string[], forHTML: boolean) {
    const text = applySampleLocalizer ? sampleLocalizationData[key] ?? key : key;

    return text.replace(/\$.|{\d+}/g, v=>{
        return v.startsWith("$") ? v.substring(1, 2) : encode(params[v.substring(1, v.length - 1)], forHTML);
    })
}
