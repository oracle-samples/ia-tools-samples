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

  class ADVISOR_REFRESH_ASSESSMENT_LIST_FROM_LOCAL_CHAIN extends ActionChain {

    /**
     * Refresh the assessmentList and ADP variable with the locally persisted assessment list
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;

      $page.variables.assessmentList =
        await $flow.functions.getLocalAssessmentDetailList(
          $application.constants.appId,
          $application.variables.b2cAccountId,
          await $application.functions.getLocalAssessmentDB()
        );

      await Actions.callChain(context, {
        chain: 'ADVISOR_REFRESH_ASSESSMENT_ADP_CHAIN',
      });
    }
  }

  return ADVISOR_REFRESH_ASSESSMENT_LIST_FROM_LOCAL_CHAIN;
});
