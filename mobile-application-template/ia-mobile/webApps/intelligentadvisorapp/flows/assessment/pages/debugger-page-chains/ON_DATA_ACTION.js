
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

  class ON_DATA_ACTION extends ActionChain {

    /**
     * To listen to the flow data action event and pass back any returned data
     * @param {Object} context
     * @param {Object} params
     * @param {application:FlowDataActionProps} params.dataActionDetail 
     * @param {application:AssessmentItem} params.assessmentDetail 
     */
    async run(context, { dataActionDetail, assessmentDetail }) {
      const { $page, $flow, $application } = context;
      const vbChainInvocationSkipped = dataActionDetail.customProperties['Skip Visual Builder Action Chain Invocation'] ?? dataActionDetail.customProperties.vbActionChainSkipped;
      if (vbChainInvocationSkipped === true) {
        return;
      }

      const dataActionId = await this.getActionChainId(context, { actionDetails: dataActionDetail });

      const dataActionResult = await Actions.callChain(context, {
        id: 'flow:'+dataActionId,
        params: {
          assessmentDetail: assessmentDetail,
          dataActionDetail: dataActionDetail,
        },
      });

      if (dataActionResult !== null && dataActionResult !== $application.constants.defaultFailureString) {
        await Actions.callChain(context, {
          id: 'ON_DATA_ACTION_RETURN',
          params: {
            dataActionId: dataActionDetail.controlId,
            returnData: dataActionResult,
          },
        });
      }
    }

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {object} params.actionDetails 
     */
    async getActionChainId(context, { actionDetails }) {
      const { $page, $flow, $application } = context;
    
      return (actionDetails.customProperties['Visual Builder Action Chain ID'] ?? actionDetails.customProperties.vbActionChainId) || actionDetails.schemeId.replace(/[^a-zA-Z0-9_-]/g, '');
    }
  }

  return ON_DATA_ACTION;
});
