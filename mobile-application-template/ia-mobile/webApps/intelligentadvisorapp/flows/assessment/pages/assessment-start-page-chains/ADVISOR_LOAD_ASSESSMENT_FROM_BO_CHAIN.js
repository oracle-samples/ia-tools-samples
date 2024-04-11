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

  class ADVISOR_LOAD_ASSESSMENT_FROM_BO_CHAIN extends ActionChain {

    /**
     * To load assessments from Assessments Business Object to the assessment list variable
     * @param {Object} context
     * @param {Object} params
     * @param {flow:LocalAssessmentItem[]} params.assessmentList 
     * @return {flow:LocalAssessmentItem} 
     */
    async run(context, { assessmentList }) {
      const { $page, $flow, $application } = context;

      // Load assessment list from BO
      const callRestBusinessObjectsGetallAssessmentsResult = await Actions.callRest(context, {
        endpoint: 'businessObjects/getall_Assessments',
        uriParams: {
          q: "userId=" + $application.variables.b2cAccountId,
          limit: 99999,
        },
        responseType: 'GetAllAssessmentsResponse',
      });

      if (!callRestBusinessObjectsGetallAssessmentsResult.ok) {
        await Actions.callChain(context, {
          id: 'application:GLOBAL_ERROR_HANDLER_CHAIN',
          params: {
            response: callRestBusinessObjectsGetallAssessmentsResult,
            type: $application.constants.errorTypes.getAllAssessmentFromBO,
          },
        });

        // To avoid VB bugs, return the input assessment list
        return assessmentList;

      } else {
        const newAssessmentList = [];
        const boAssessments = callRestBusinessObjectsGetallAssessmentsResult.body.items;
        for (const boItem of boAssessments) {
          if (!assessmentList.some((element) => (boItem.id === element.id))) {
            newAssessmentList.push({
              ...boItem,
              pendingSync: false
            });
          }
        }
        newAssessmentList.push(...assessmentList);
        return newAssessmentList;
      }
    }
  }

  return ADVISOR_LOAD_ASSESSMENT_FROM_BO_CHAIN;
});
