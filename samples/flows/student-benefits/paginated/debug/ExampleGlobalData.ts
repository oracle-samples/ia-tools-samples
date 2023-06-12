/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
interface DataSet {
    name: string,
    data: object
}

const definedGenders = [
    { "value": "female", "text": "Female" },
    { "value": "male", "text": "Male" }
];
const definedCitizenshipStatuses = [
    { value: "citizen" , text: "Citizen" },
    { value: "national" , text: "National" },
    { value: "permanent resident" , text: "Permanent Resident" },
    { value: "other" , text: "Other" }
];
const definedEnrollmentStatuses = [
    { value: "enrolled" , text: "Enrolled" },
    { value: "accepted" , text: "Accepted for enrollment" },
    { value: "not enrolled" , text: "Not enrolled" }
];

export const exampleGlobalDataSets: DataSet[] = [
    {
        name: "Student Benefits (no student)",
        data: {
            // no student id supplied
            "defined-genders": definedGenders,
            "defined-citizenship-statuses": definedCitizenshipStatuses,
            "defined-enrollment-statuses": definedEnrollmentStatuses
        }
    },
    {
        name: "Student Benefits Student #1",
        data: {
            "existing-student-id": 1,
            "defined-genders": definedGenders,
            "defined-citizenship-statuses": definedCitizenshipStatuses,
            "defined-enrollment-statuses": definedEnrollmentStatuses
        }
    },
    {
        name: "Student Benefits Student #2",
        data: {
            "existing-student-id": 2,
            "defined-genders": [
                // the order is reversed, and the displayed text is different, but
                // "value" (the identifying field) is consistent
                { "value": "male", "text": "Man" },
                { "value": "female", "text": "Woman" }
            ],
            "defined-citizenship-statuses": definedCitizenshipStatuses,
            "defined-enrollment-statuses": definedEnrollmentStatuses
        }
    },
    {
        name: "Student Benefits Student #3",
        data: {
            "existing-student-id": 3,
            "defined-genders": definedGenders,
            "defined-citizenship-statuses": definedCitizenshipStatuses,
            "defined-enrollment-statuses": definedEnrollmentStatuses
        }
    },
];