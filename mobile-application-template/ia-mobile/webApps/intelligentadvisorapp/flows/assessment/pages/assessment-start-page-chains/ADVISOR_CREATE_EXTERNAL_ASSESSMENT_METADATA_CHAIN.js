/**
 * Copyright © 2023, Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
define([
  'vb/action/actionChain',
  'vb/action/actions',
  'vb/action/actionUtils',
], (
  ActionChain,
  Actions,
  ActionUtils
) => {
  'use strict';

  class ADVISOR_CREATE_EXTERNAL_ASSESSMENT_METADATA_CHAIN extends ActionChain {

    /**
     * To create a new entry in the remote assessment metadata resource based on the local assessment
     * @param {Object} context
     * @param {Object} params
     * @param {any} params.assessment 
     * @return {string} 
     */
    async run(context, { assessment }) {
      const { $page, $flow, $application } = context;

      const callRestB2cRestApiPostOPAMobileAssessmentResult = await Actions.callRest(context, {
        endpoint: 'b2cRestApi/postOPAMobileAssessment',
        body: {
          "Description": assessment.assessmentName,
          "Deployment": assessment.deploymentName,
          "Status": {
            "lookupName": assessment.status
          },
          "Account": {
            "id": $application.variables.b2cAccountId
          }
        }
      });

      if (!callRestB2cRestApiPostOPAMobileAssessmentResult.ok) {
        await Actions.callChain(context, {
          id: 'application:GLOBAL_ERROR_HANDLER_CHAIN',
          params: {
            response: callRestB2cRestApiPostOPAMobileAssessmentResult,
            type: $application.constants.errorTypes.b2cCreateAssessment,
          },
        });
        return '';
      } else {
        return callRestB2cRestApiPostOPAMobileAssessmentResult.body.id.toString();
      }

    }
  }

  return ADVISOR_CREATE_EXTERNAL_ASSESSMENT_METADATA_CHAIN;
});
