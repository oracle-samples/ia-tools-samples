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

  class ADVISOR_REFRESH_ASSESSMENT_ADP_CHAIN extends ActionChain {

    /**
     * To reload the assessment ADP from the page's assessment list variable
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;

      // Reverse the order and filter
      const adpDataArr = [];
      for (let i = $page.variables.assessmentList.length - 1; i > -1; i--) {
        const assessment = $page.variables.assessmentList[i];
        if (assessment.status !== 'Aborted' && assessment.status !== 'Cancelled') {
          adpDataArr.push(assessment);
        }
      }

      $page.variables.assessmentListADP.data = adpDataArr;

      await Actions.fireDataProviderEvent(context, {
        target: $page.variables.assessmentListADP,
        refresh: null,
      });
    }
  }

  return ADVISOR_REFRESH_ASSESSMENT_ADP_CHAIN;
});
