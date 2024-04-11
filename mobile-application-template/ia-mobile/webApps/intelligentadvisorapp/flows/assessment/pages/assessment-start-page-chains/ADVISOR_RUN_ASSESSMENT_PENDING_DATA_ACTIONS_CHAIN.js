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

  class ADVISOR_RUN_ASSESSMENT_PENDING_DATA_ACTIONS_CHAIN extends ActionChain {

    /**
     * To run the pending data actions of a local assessment
     * @param {Object} context
     * @param {Object} params
     * @param {flow:LocalAssessmentItem} params.assessment 
     */
    async run(context, { assessment }) {
      const { $page, $flow, $application } = context;

      const dataActionLocalDB = await $application.functions.getLocalDataActionDB();
      const pendingDataActions = await $flow.functions.getAllPendingDataActions(
        $application.constants.appId,
        $application.variables.b2cAccountId,
        assessment.id,
        dataActionLocalDB
      );

      await ActionUtils.forEach(pendingDataActions, async (dataActionDetail, index) => {
        const dataActionResult = await Actions.callChain(context, {
          chain: 'flow:ADVISOR_FLOW_DATA_ACTION_CHAIN',
          params: {
            assessmentDetail: assessment,
            dataActionDetail: dataActionDetail
          },
        });
        if (dataActionResult !== $application.constants.defaultFailureString) {
          await $flow.functions.deletePendingDataAction(
            $application.constants.appId,
            $application.variables.b2cAccountId,
            assessment.id,
            dataActionDetail,
            dataActionLocalDB
          );
        }
      }, { mode: 'serial' });
    }
  }

  return ADVISOR_RUN_ASSESSMENT_PENDING_DATA_ACTIONS_CHAIN;
});
