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

  class ADVISOR_PERSIST_ASSESSMENTS_LOCALLY_CHAIN extends ActionChain {

    /**
     * To persist the assessment list variable value into the local storage
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;

      await $flow.functions.refreshAllAssessmentDetailsLocally(
        $application.constants.appId,
        $application.variables.b2cAccountId,
        $page.variables.assessmentList,
        await $application.functions.getLocalAssessmentDB()
      );
    }
  }

  return ADVISOR_PERSIST_ASSESSMENTS_LOCALLY_CHAIN;
});
