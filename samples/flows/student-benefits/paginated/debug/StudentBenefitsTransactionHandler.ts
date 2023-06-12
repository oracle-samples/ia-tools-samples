/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IASentDataObject } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { logger } from "../src/Application";
import { TransactionHandler } from "./DebugDataAdapter";

// GET STUDENT ACTION PROPERTIES
const getStudentActionSchemeID = "get-student";

const getStudentInputStudentID = "id";

const getStudentReturnedName = "name";
const getStudentReturnedGender = "gender";
const getStudentReturnedCitizenshipStatus = "citizenship-status";
const getStudentReturnedEnrollmentStatus = "enrollment-status";
const getStudentExpectedReturnProps = [getStudentReturnedName, getStudentReturnedGender, getStudentReturnedCitizenshipStatus];


// SAVE BENEFIT ACTION PROPERTIES
const saveBenefitActionSchemeID = "save-student-benefit-request";

const saveBenefitInputExistingID = "existing-student-id";
const saveBenefitInputName = "student-name";
const saveBenefitInputGender = "gender";
const saveBenefitInputCitizenship = "citizenship-status";
const saveBenefitInputEnrollment = "enrollment-status";
/** The 'existing-student-id' isn't expected in the case that no student data was loaded at the start */
const saveBenefitExpectedInputProps = [saveBenefitInputName, saveBenefitInputGender, saveBenefitInputCitizenship, saveBenefitInputEnrollment];

const saveBenefitReturnedFailureMessage = "failure-message";
const saveBenefitReturnedReferenceNumber = "request-reference-number";
const saveBenefitExpectedReturnProps = [saveBenefitReturnedFailureMessage, saveBenefitReturnedReferenceNumber];
const saveBenefitActionError = {};
saveBenefitActionError[saveBenefitReturnedFailureMessage] = "Your benefit could not be saved, please contact administration";

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

        // ensure the action's properties were set up correctly
        if (inputData && Object.keys(inputData.fields).length > 0 && !inputData.fields.hasOwnProperty(getStudentInputStudentID)) {
            logger.error(`Expected input property "${getStudentInputStudentID}" for the "${getStudentActionSchemeID}" operation`);
            return null;
        }
        let propertyErrors = false;
        getStudentExpectedReturnProps.forEach(p => {
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
        returnedData[getStudentReturnedName] = student.name;
        returnedData[getStudentReturnedGender] = student.gender;
        returnedData[getStudentReturnedCitizenshipStatus] = student.citizenshipStatus;
        returnedData[getStudentReturnedEnrollmentStatus] = student.enrollmentStatus;
        return returnedData;
    }
}

export const studentBenefits_SaveStudentBenefitHandler: TransactionHandler = {
    actionSchemeID: saveBenefitActionSchemeID,
    handleTransaction: (inputData: IASentDataObject, resultDefinition: any) => {

        let inputPropertyErrors = false;
        saveBenefitExpectedInputProps.forEach(p => {
            if (!inputData.fields.hasOwnProperty(p)) {
                logger.error(`Missing expected property "${p}" from input data`);
                inputPropertyErrors = true;
            }
        });
        if (inputPropertyErrors) {
            logger.error("Input data is: " + JSON.stringify(inputData.fields));
            return saveBenefitActionError;
        }

        let returnPropertyErrors = false;
        saveBenefitExpectedReturnProps.forEach(p => {
            if (!resultDefinition.properties.hasOwnProperty(p)) {
                logger.error(`Missing expected property "${p}" from returned data definition`);
                returnPropertyErrors = true;
            }
        });
        if (returnPropertyErrors) {
            logger.error("Data definition's allowed return properties are: " + JSON.stringify(resultDefinition.properties));
            return saveBenefitActionError;
        }

        const existingStudentId = inputData.fields[saveBenefitInputExistingID];
        let saveLog;

        if (existingStudentId) {
            saveLog = `Updating existing student with ID '${existingStudentId}'`;
        } else {
            saveLog = "Creating new student";
        }
        saveLog += " with data:";
        // data is not actually saved anywhere in the debug implementation, just collect the data to present on the console
        saveBenefitExpectedInputProps.forEach(p => saveLog += `\n  ${p}: ${inputData.fields[p]}`);

        // similarly, generate a fake submitted benefit request reference number:
        const createdBenefitRequestNumber = "BENREQ#" + (1 + Math.round(Math.random() * 100000));
        saveLog += `\nCreated benefit request with reference number: ${createdBenefitRequestNumber}`;

        // 'save' the data (to the console)
        logger.log(saveLog);

        const returnedData = {};
        // note: the 'failure-message' property is only returned if 
        returnedData[saveBenefitReturnedReferenceNumber] = createdBenefitRequestNumber;
        return returnedData;
    }
}