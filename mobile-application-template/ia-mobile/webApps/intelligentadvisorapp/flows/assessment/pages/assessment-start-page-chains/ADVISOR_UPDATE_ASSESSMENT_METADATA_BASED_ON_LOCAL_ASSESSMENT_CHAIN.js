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

  class ADVISOR_UPDATE_ASSESSMENT_METADATA_BASED_ON_LOCAL_ASSESSMENT_CHAIN extends ActionChain {

    /**
     * To update the corresponding assessment metadata in the BO and the remote based on the local assessment
     * @param {Object} context
     * @param {Object} params
     * @param {flow:LocalAssessmentItem} params.assessment 
     * @return {flow:LocalAssessmentItem} 
     */
    async run(context, { assessment }) {
      const { $page, $flow, $application } = context;

      // Get the current external assessment status
      let externalAssessments = [];
      try {
        externalAssessments = await Actions.callChain(context, {
          chain: 'ADVISOR_LIST_EXTERNAL_ASSESSMENT_METADATA_CHAIN',
          params: {
            externalId: assessment.externalId,
            statuses: ['In Progress', 'Complete'],
          },
        });
      } catch (error) {
        return assessment;
      }

      if (externalAssessments.length > 0) {
        const externalAssessmentItem = externalAssessments[0];
        if (externalAssessmentItem.status !== assessment.status) {
          // It is good to update the external assessment status with the local status
          const updateExternalAssessmentStatusResult = await Actions.callChain(context, {
            chain: 'ADVISOR_UPDATE_EXTERNAL_ASSESSMENT_STATUS_CHAIN',
            params: {
              externalId: assessment.externalId,
              status: assessment.status,
            },
          });

          if (!updateExternalAssessmentStatusResult) {
            return assessment;
          }
        }

        // Update the assessment fields for convenience
        assessment.assessmentName = externalAssessmentItem.assessmentName;
        assessment.deploymentName = externalAssessmentItem.deploymentName;
        assessment.externalDataId = externalAssessmentItem.externalDataId;

      } else {
        // The external assessment metadata has been updated or deleted. Mark the assessment as cancelled.
        assessment.status = 'Cancelled';
      }

      // Update the assessment status in BO
      const updateAssessmentBOResult = await Actions.callChain(context, {
        chain: 'ADVISOR_UPDATE_ASSESSMENT_BO_CHAIN',
        params: {
          localAssessment: assessment,
        },
      });

      if (!updateAssessmentBOResult) {
        return assessment;
      }

      assessment.pendingSync = false;

      return assessment;
    }
  }

  return ADVISOR_UPDATE_ASSESSMENT_METADATA_BASED_ON_LOCAL_ASSESSMENT_CHAIN;
});
