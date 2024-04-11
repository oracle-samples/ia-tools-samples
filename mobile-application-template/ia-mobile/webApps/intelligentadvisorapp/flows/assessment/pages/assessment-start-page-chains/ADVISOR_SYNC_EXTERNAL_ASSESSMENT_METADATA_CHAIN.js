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

  class ADVISOR_SYNC_EXTERNAL_ASSESSMENT_METADATA_CHAIN extends ActionChain {

    /**
     * To synchronize the external assessment metadata down to the app
     * 
     * @param {Object} context
     * @param {Object} params
     * @param {flow:LocalAssessmentItem[]} params.assessmentList 
     * @return {flow:LocalAssessmentItem[]} 
     */
    async run(context, { assessmentList }) {
      const { $page, $flow, $application } = context;

      // Build a map keyed by the external ID based on the assessmentList variable
      const localAssessmentWithExternalId = assessmentList.filter((assessment) => (assessment.externalId != null && assessment.status !== 'Aborted'));
      const localAssessmentMap = new Map(localAssessmentWithExternalId.map((assessment) => [assessment.externalId.toString(), assessment]));

      // Load the external assessments
      let externalAssessments = [];
      try {
        externalAssessments = await Actions.callChain(context, {
          chain: 'ADVISOR_LIST_EXTERNAL_ASSESSMENT_METADATA_CHAIN',
          params: {
            statuses: ['Open', 'Cancelled'],
          },
        });
      } catch (error) {
        // Already notification inside the chain, so no further action
      }

      // Parallely check each 'Open' or 'Cancelled' external assessment
      await ActionUtils.forEach(externalAssessments, async (externalAssessment, index) => {
        if (localAssessmentMap.has(externalAssessment.externalId)) {
          // There is already a local assessment with the corresponding external ID
          const localAssessment = localAssessmentMap.get(externalAssessment.externalId);
          if (localAssessment.status !== externalAssessment.status) {
            // Inconsistent status found
            // Update the local assessment object
            localAssessment.status = externalAssessment.status === 'Open' ? 'Aborted' : externalAssessment.status;
            localAssessment.pendingSync = false;

            // Delete the pending data actions if any
            await $flow.functions.deleteAllPendingDataActions(
              $application.constants.appId,
              $application.variables.b2cAccountId,
              localAssessment.id,
              await $application.functions.getLocalDataActionDB()
            );

            // Delete the local assessment session if any
            await $flow.functions.deleteLocalAssessmentSession(
              localAssessment.id,
              $application.constants.appId,
              await $application.functions.getLocalAssessmentDB()
            );

            // Update the assessment BO
            await Actions.callChain(context, {
              chain: 'ADVISOR_UPDATE_ASSESSMENT_BO_CHAIN',
              params: {
                localAssessment: localAssessment,
              },
            });

            // Note: 
            // Whether the BO update was successful should be checked to prevent a corner case.
            // But the additional status check is tricky compared with the impact of the corner case.
            // To be reviewed later.
          }
        }

        if (externalAssessment.status === 'Open') {
          // This is a new or re-opened assessment assigned to the current user
          externalAssessment.status = 'In Progress';
          
          // Update the external assessment status to 'In Progress'
          const updateExternalStatusResult = await Actions.callChain(context, {
            chain: 'ADVISOR_UPDATE_EXTERNAL_ASSESSMENT_STATUS_CHAIN',
            params: {
              externalId: externalAssessment.externalId,
              status: externalAssessment.status,
            },
          });

          if (updateExternalStatusResult) {
            // Create the assessment in BO
            const newBOAssessmentId = await Actions.callChain(context, {
              chain: 'ADVISOR_CREATE_ASSESSMENT_BO_CHAIN',
              params: {
                assessment: externalAssessment,
              },
            });

            if (newBOAssessmentId >= 0) {
              const newAssessmentDetail = {
                id: newBOAssessmentId,
                assessmentName: externalAssessment.assessmentName,
                deploymentName: externalAssessment.deploymentName,
                externalId: externalAssessment.externalId,
                externalDataId: externalAssessment.externalDataId,
                status: externalAssessment.status,
                userId: $application.variables.b2cAccountId,
                pendingSync: false
              };

              // Add the created assessment to the assessment list
              assessmentList.push(newAssessmentDetail);

              // Invoke initial data actions if any
              await Actions.callChain(context, {
                chain: 'ADVISOR_ASSESSMENT_INITIAL_DATA_LOAD_CHAIN',
                params: {
                  assessmentDetail: newAssessmentDetail,
                },
              });
              
            }
          }
        }

      }, { mode: 'parallel' });

      return assessmentList;
    }
  }

  return ADVISOR_SYNC_EXTERNAL_ASSESSMENT_METADATA_CHAIN;
});
