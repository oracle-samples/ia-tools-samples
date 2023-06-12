/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IASentDataObject } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { logger } from "../src/Application";
import { TransactionHandler } from "./DebugDataAdapter";

const getStudentActionSchemeID = "get-student";
const inputIdProperty = "id";
const returnedNameProperty = "name";
const returnedGenderProperty = "gender";
const returnedCitizenshipStatus = "citizenship-status";
const expectedReturnProps = [returnedNameProperty, returnedGenderProperty, returnedCitizenshipStatus];

const studentData = [
    {
        id: 1,
        name: "George",
        gender: "male",
        citizenshipStatus: "citizen",
        enrollmentStatus: "enrolled"
    },
    {
        id: 2,
        name: "Sally",
        gender: "female",
        citizenshipStatus: "other",
        enrollmentStatus: "accepted"
    },
    {
        id: 3,
        name: "John",
        gender: "male",
        citizenshipStatus: "permanent resident",
        enrollmentStatus: "not enrolled"
    },
];

export const studentBenefits_GetStudentHandler: TransactionHandler = {
    actionSchemeID: getStudentActionSchemeID,
    handleTransaction: (inputData: IASentDataObject, resultDefinition: any) => {
        if (inputData && Object.keys(inputData.fields).length === 0) {
            logger.log("A student ID wasn't supplied, so no student details were loaded");
            return null;
        }
        if (inputData && Object.keys(inputData.fields).length > 0 && !inputData.fields.hasOwnProperty(inputIdProperty)) {
            logger.error(`Expected input property "${inputIdProperty}" for the "${getStudentActionSchemeID}" operation`);
            return null;
        }
        let propertyErrors = false;
        expectedReturnProps.forEach(p => {
            if (!resultDefinition.properties.hasOwnProperty(p)) {
                logger.error(`Missing expected property "${p}" from returned data definition`);
                propertyErrors = true;
            }
        });
        if (propertyErrors) {
            logger.error("Expected properties are: " + JSON.stringify(resultDefinition.properties));
            return null;
        }

        const existingStudentId = inputData.fields["id"];
        const student = studentData.find(s => s.id === existingStudentId);
        const returnedData = {};
        returnedData[returnedNameProperty] = student.name;
        returnedData[returnedGenderProperty] = student.gender;
        returnedData[returnedCitizenshipStatus] = student.citizenshipStatus;
        return returnedData;
    }
}