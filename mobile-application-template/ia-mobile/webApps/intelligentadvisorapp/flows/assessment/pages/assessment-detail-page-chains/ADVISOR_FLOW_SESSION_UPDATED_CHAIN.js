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

  class ADVISOR_FLOW_SESSION_UPDATED_CHAIN extends ActionChain {

    /**
     * To save current progress to local when save action triggered from component
     * @param {Object} context
     * @param {Object} params
     * @param {CurrentIaSessionDetails} params.currentSession 
     */
    async run(context, { currentSession }) {
      const { $page, $flow, $application } = context;

      await $flow.functions.saveAssessmentSessionLocally(
        $page.variables.assessmentDetails.id,
        currentSession,
        $application.constants.appId,
        await $application.functions.getLocalAssessmentDB()
      );

      if (currentSession.actionSource === 'saveButton') {
        await Actions.fireNotificationEvent(context, {
          summary: $application.translations.app.assessment_progress_saved_locally,
          displayMode: 'transient',
          type: 'info',
        });
      }
    }
  }

  return ADVISOR_FLOW_SESSION_UPDATED_CHAIN;
});
