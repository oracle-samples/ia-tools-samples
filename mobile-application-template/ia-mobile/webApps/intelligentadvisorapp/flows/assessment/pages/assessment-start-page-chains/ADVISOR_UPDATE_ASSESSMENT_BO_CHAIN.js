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

  class ADVISOR_UPDATE_ASSESSMENT_BO_CHAIN extends ActionChain {

    /**
     * To update the localAssessment BO based on the given localAssessment
     * @param {Object} context
     * @param {Object} params
     * @param {flow:LocalAssessmentItem} params.localAssessment The localAssessment item
     * @return {boolean} 
     */
    async run(context, { localAssessment }) {
      const { $page, $flow, $application } = context;

      const boRequestBody = { ...localAssessment };
      delete boRequestBody.id;
      delete boRequestBody.pendingSync;

      const callRestBusinessObjectsUpdateAssessmentsResult = await Actions.callRest(context, {
        endpoint: 'businessObjects/update_Assessments',
        uriParams: {
          'Assessments_Id': localAssessment.id,
        },
        body: boRequestBody,
        responseBodyFormat: 'json',
      });

      if (!callRestBusinessObjectsUpdateAssessmentsResult.ok) {
        const callChainApplicationGLOBALERRORHANDLERCHAIN3Result = await Actions.callChain(context, {
          id: 'application:GLOBAL_ERROR_HANDLER_CHAIN',
          params: {
            response: callRestBusinessObjectsUpdateAssessmentsResult,
            type: $application.constants.errorTypes.boUpdateAssessment,
          },
        });
        return false;
      }

      return true;
    }
  }

  return ADVISOR_UPDATE_ASSESSMENT_BO_CHAIN;
});
