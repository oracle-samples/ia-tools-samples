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

  class ADVISOR_FLOW_COMPLETED_CHAIN extends ActionChain {

    /**
     * To handle the assessment status change to "Complete"
     * 
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;

      // Update the local assessment status to "Complete"
      $page.variables.assessmentDetails.status = 'Complete';
      $page.variables.assessmentDetails.pendingSync = true;
      await $flow.functions.updateLocalAssessmentDetails(
          $page.variables.assessmentDetails,
          $application.constants.appId,
          $application.variables.b2cAccountId,
          await $application.functions.getLocalAssessmentDB()
      );

      if (!$application.constants.useConfirmationPage) {
        // TODO: use a better approach to wait for all data action chains to be invoked before navigating to another page
        await $application.functions.delay(3);

        await Actions.navigateToPage(context, {
          page: 'assessment-start',
        });
      }
    }
  }

  return ADVISOR_FLOW_COMPLETED_CHAIN;
});
