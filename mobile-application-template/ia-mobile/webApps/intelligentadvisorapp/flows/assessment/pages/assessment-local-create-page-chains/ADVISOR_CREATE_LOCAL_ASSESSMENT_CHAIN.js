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

  class ADVISOR_CREATE_LOCAL_ASSESSMENT_CHAIN extends ActionChain {

    /**
     * To create a new assessment detail locally and navigate to the assessment-detail page
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;

      // Mark create in progress
      $page.variables.createAssessmentsChainInProgress = true;

      // Validates Assessments form
      const formValidationResult = await Actions.callChain(context, {
        id: 'flow:ADVISOR_VALIDATE_ASSESSMENT_CHAIN',
        params: {
          validationGroupId: 'validation-group',
        },
      }, { id: 'validateAssessments' });

      if (formValidationResult === true) {
        const appOfflineMode = $application.constants.useCachedFlow.toLowerCase() === 'always';
        const assessmentTempId = Date.now();
        const newAssessmentDetail = {
          id: assessmentTempId,
          assessmentName: $page.variables.assessment.assessmentName,
          deploymentName: $page.variables.assessment.deploymentName,
          externalId: null,
          status: 'In Progress',
          userId: $application.variables.b2cAccountId,
          pendingSync: true
        };

        await $flow.functions.saveAssessmentDetailsLocally(
          $application.constants.appId,
          newAssessmentDetail,
          await $application.functions.getLocalAssessmentDB()
        );

        $page.variables.createAssessmentsChainInProgress = false;

        await Actions.navigateToPage(context, {
          page: 'assessment-detail',
          params: {
            assessmentId: assessmentTempId,
            offlineMode: appOfflineMode,
          },
        });
      } else {
        $page.variables.createAssessmentsChainInProgress = false;
      }
    }
  }

  return ADVISOR_CREATE_LOCAL_ASSESSMENT_CHAIN;
});
