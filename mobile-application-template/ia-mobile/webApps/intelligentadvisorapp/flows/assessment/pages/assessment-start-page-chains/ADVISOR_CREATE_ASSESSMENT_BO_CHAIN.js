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

  class ADVISOR_CREATE_ASSESSMENT_BO_CHAIN extends ActionChain {

    /**
     * To create a new entry in the Assessment Business Object based on the local assessment
     * @param {Object} context
     * @param {Object} params
     * @param {any} params.assessment 
     * @return {number} 
     */
    async run(context, { assessment }) {
      const { $page, $flow, $application } = context;

      const callRestBusinessObjectsCreateAssessmentsResult = await Actions.callRest(context, {
        endpoint: 'businessObjects/create_Assessments',
        body: {
          assessmentName: assessment.assessmentName,
          deploymentName: assessment.deploymentName,
          externalId: assessment.externalId,
          externalDataId: assessment.externalDataId,
          status: assessment.status,
          userId: $application.variables.b2cAccountId
        }
      });

      if (!callRestBusinessObjectsCreateAssessmentsResult.ok) {
        await Actions.callChain(context, {
          id: 'application:GLOBAL_ERROR_HANDLER_CHAIN',
          params: {
            response: callRestBusinessObjectsCreateAssessmentsResult,
            type: $application.constants.errorTypes.boCreateAssessment,
          },
        });
        return -1;
      }

      return callRestBusinessObjectsCreateAssessmentsResult.body.id;
    }
  }

  return ADVISOR_CREATE_ASSESSMENT_BO_CHAIN;
});
