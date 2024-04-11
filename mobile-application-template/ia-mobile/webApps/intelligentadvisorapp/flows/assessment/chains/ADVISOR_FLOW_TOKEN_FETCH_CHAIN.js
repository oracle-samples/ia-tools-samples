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

  class ADVISOR_FLOW_TOKEN_FETCH_CHAIN extends ActionChain {

    /**
     * To fetch the flow token to start or resume an assessment
     * @param {Object} context
     * @param {Object} params
     * @param {LocalAssessmentItem} params.assessmentDetail 
     * @return {string} 
     */
    async run(context, { assessmentDetail }) {
      const { $flow, $application } = context;

      const callRestIaHubApiIaFlowStartResult = await Actions.callRest(context, {
        endpoint: 'iaHubApi/iaFlowStart',
        body: {
          action: 'startOrResume',
          deployment: assessmentDetail.deploymentName,
        },
      });

      if (!callRestIaHubApiIaFlowStartResult.ok) {
        // Show the error notification
        await Actions.callChain(context, {
          id: 'application:GLOBAL_ERROR_HANDLER_CHAIN',
          params: {
            response: callRestIaHubApiIaFlowStartResult,
            type: $application.constants.errorTypes.startSession,
          },
        });

        return '';

      } else {
        return callRestIaHubApiIaFlowStartResult.body.jwt;
      }
    }
  }

  return ADVISOR_FLOW_TOKEN_FETCH_CHAIN;
});
