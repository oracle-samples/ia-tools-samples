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

  class ADVISOR_ON_FLOW_DATA_ACTION_CHAIN extends ActionChain {

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

      const dataActionResult = await Actions.callChain(context, {
        chain: 'flow:ADVISOR_FLOW_DATA_ACTION_CHAIN',
        params: {
          assessmentDetail: assessmentDetail,
          dataActionDetail: dataActionDetail,
        },
      });

      if (dataActionResult != null && dataActionResult !== $application.constants.defaultFailureString) {
        await Actions.callChain(context, {
          id: 'ADVISOR_SET_FLOW_DATA_ACTION_RETURN_VALUE_CHAIN',
          params: {
            dataActionId: dataActionDetail.controlId,
            returnData: dataActionResult,
          },
        });
      }
    }
  }

  return ADVISOR_ON_FLOW_DATA_ACTION_CHAIN;
});
