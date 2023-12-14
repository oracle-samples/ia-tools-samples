export const tools = [
    {
        type: "function",
        function: {
            name: "doINeedToFile",
            description: `This tool determines whether a tax return needs to be filed for 2022. The response is a JSON payload of the form { "tax_return_needed": "true" }` +
                          `It will try to answer even if only some of the parameters are provided. You should start by asking the user only for their gross income and filing status.` +
                          `If this tool returns null, then it means that one or more of the optional parameters needs to be supplied. ` +
                          `Try asking the user to provide one of those additional pieces of information, and call the tool again.`,
            parameters: {
                "type": "object",
                "properties": {
                    "filing_status": {
                        "type": "string",
                        "description": "The customer's filing status such as Single, Married filing jointly, Married filing separately or Head of household",
                    },
                    "gross_income": {
                        "type": "number",
                        "description": "The customer's filing gross income. Does not include their spouse's gross income, if any",
                    },
                    "spouses_gross_income": {
                        "type": "number",
                        "description": "The spouse's gross income, if any",
                    },
                    "medical_savings_distributions": {
                        "type": "boolean",
                        "description": "True if the person received distributions from a medical savings account, or from a health savings account",
                    },
                    "recapture_taxes_owed": {
                        "type": "boolean",
                        "description": "True if the person owes recapture taxes",
                    },
                    "estimated_tax_payments_made": {
                        "type": "boolean",
                        "description": "True if the person made estimated tax payments during the tax year",
                    },
                    "additional_child_credit": {
                        "type": "boolean",
                        "description": "True if the person is claiming the additional child tax credit",
                    },
                },
                required: ["filing_status"]
            }
        }
    }
    ,
    {
        type: "function",
        function: {
            name: "taxpayerInformation",
            description: `Returns information about a taxpayer. The response is a JSON payload of the form { "filing_status" : "Single | Married filing jointly | etc.", "date_of_birth" : 2001-01-01 } ]`,
            parameters: {
                "type": "object",
                "properties": {
                    "theCustomerID": {
                        "type": "string",
                        "description": "The customer's identifier",
                    },
                },
                required: ["theCustomerID"]
            }
        }
    }
];
