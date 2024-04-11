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

  class ADVISOR_SYNC_LOCAL_ASSESSMENT_PENDING_CHANGES_CHAIN extends ActionChain {

    /**
     * Invoke cached data actions and synchronize local assessments' pending metadata changes
     * @param {Object} context
     * @param {Object} params
     * @param {flow:LocalAssessmentItem[]} params.assessmentList 
     * @return {flow:LocalAssessmentItem[]} 
     */
    async run(context, { assessmentList }) {
      const { $page, $flow, $application } = context;

      const updatedAssessmentList = [];

      await ActionUtils.forEach(assessmentList, async (assessment, index) => {
        let updatedAssessment;

        if (assessment.pendingSync === true) {
          if (assessment.externalId) {
            // Update assessment metadata
            updatedAssessment = await Actions.callChain(context, {
              chain: 'ADVISOR_UPDATE_ASSESSMENT_METADATA_BASED_ON_LOCAL_ASSESSMENT_CHAIN',
              params: {
                assessment: assessment,
              },
            });
          } else {
            // Create assessment metadata
            updatedAssessment = await Actions.callChain(context, {
              chain: 'ADVISOR_CREATE_ASSESSMENT_METADATA_BASED_ON_LOCAL_ASSESSMENT_CHAIN',
              params: {
                assessment: assessment,
              },
            });
          }
        } else {
          updatedAssessment = assessment;
        }

        if (updatedAssessment.status !== 'Cancelled') {
          // Invoke pending data actions for the local assessment
          await Actions.callChain(context, {
            chain: 'ADVISOR_RUN_ASSESSMENT_PENDING_DATA_ACTIONS_CHAIN',
            params: {
              assessment: updatedAssessment,
            },
          });
        } else {
          await $flow.functions.deleteAllPendingDataActions(
            $application.constants.appId,
            $application.variables.b2cAccountId,
            updatedAssessment.id,
            await $application.functions.getLocalDataActionDB()
          );
        }

        updatedAssessmentList.push(updatedAssessment);

      }, { mode: 'serial' });

      return updatedAssessmentList;
    }
  }

  return ADVISOR_SYNC_LOCAL_ASSESSMENT_PENDING_CHANGES_CHAIN;
});
