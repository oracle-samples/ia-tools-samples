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

  class ADVISOR_DELETE_ASSESSMENT_CHAIN extends ActionChain {

    /**
     * To update the assessment status to Cancelled
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;

      $page.variables.isSyncing = true;

      if ($page.variables.assessmentToDelete?.id) {
        $page.variables.assessmentToDelete.status = 'Cancelled';
        $page.variables.assessmentToDelete.pendingSync = true;

        await $flow.functions.updateLocalAssessmentDetails(
          $page.variables.assessmentToDelete,
          $application.constants.appId,
          $application.variables.b2cAccountId,
          await $application.functions.getLocalAssessmentDB()
        );

        await Actions.callChain(context, {
          chain: 'ADVISOR_REFRESH_ASSESSMENT_LIST_FROM_LOCAL_CHAIN',
        });

        await Actions.fireNotificationEvent(context, {
          displayMode: 'transient',
          type: 'confirmation',
          summary: $application.translations.app.assessment_deleted_title,
          message: $application.translations.format('app', 'assessment_deleted_message', { assessmentName: $page.variables.assessmentToDelete.assessmentName }),
        });

        // Clean up the assessmentToDelete variable
        await Actions.resetVariables(context, {
          variables: [
            '$page.variables.assessmentToDelete',
          ],
        });
      }

      $page.variables.isSyncing = false;
    }
  }

  return ADVISOR_DELETE_ASSESSMENT_CHAIN;
});
