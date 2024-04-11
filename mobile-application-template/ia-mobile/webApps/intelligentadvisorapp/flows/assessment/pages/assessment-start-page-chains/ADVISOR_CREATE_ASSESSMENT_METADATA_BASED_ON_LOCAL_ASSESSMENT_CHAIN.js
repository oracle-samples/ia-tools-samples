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

  class ADVISOR_CREATE_ASSESSMENT_METADATA_BASED_ON_LOCAL_ASSESSMENT_CHAIN extends ActionChain {

    /**
     * To create the corresponding assessment metadata in the BO and the remote based on the local assessment
     * @param {Object} context
     * @param {Object} params
     * @param {flow:LocalAssessmentItem} params.assessment 
     * @return {flow:LocalAssessmentItem} 
     */
    async run(context, { assessment }) {
      const { $page, $flow, $application } = context;

      // Create the external assessment metadata 
      const externalAssessmentId = await Actions.callChain(context, {
        chain: 'ADVISOR_CREATE_EXTERNAL_ASSESSMENT_METADATA_CHAIN',
        params: {
          assessment: assessment,
        },
      });

      if (!externalAssessmentId) {
        return assessment;
      }

      // Add the external assessment ID to the assessment object
      assessment.externalId = externalAssessmentId;

      // Create the assessment metadata in BO
      const boAssessmentId = await Actions.callChain(context, {
        chain: 'ADVISOR_CREATE_ASSESSMENT_BO_CHAIN',
        params: {
          assessment: assessment,
        },
      });

      if (boAssessmentId < 0) {
        delete assessment.externalId;
        return assessment;
      }

      // Update the assessment object in the assessment list variable
      const assessmentTempId = assessment.id;
      assessment.id = boAssessmentId;

      // Replace local assessment session key
      const assessmentLocalDB = await $application.functions.getLocalAssessmentDB();
      const localSession = await $flow.functions.getLocalAssessmentSession(
        assessmentTempId,
        $application.constants.appId,
        assessmentLocalDB
      );
      await $flow.functions.saveAssessmentSessionLocally(
        assessment.id,
        localSession,
        $application.constants.appId,
        assessmentLocalDB
      );
      await $flow.functions.deleteLocalAssessmentSession(
        assessmentTempId,
        $application.constants.appId,
        assessmentLocalDB
      );

      // Replace local pending data actions
      const dataActionLocalDB = await $application.functions.getLocalDataActionDB();
      const pendingDataActions = await $flow.functions.getAllPendingDataActions(
        $application.constants.appId,
        $application.variables.b2cAccountId,
        assessmentTempId,
        dataActionLocalDB
      );
      await $flow.functions.addAllPendingDataActions(
        $application.constants.appId,
        $application.variables.b2cAccountId,
        assessment.id,
        pendingDataActions,
        dataActionLocalDB
      );
      for (const pendingDataAction of pendingDataActions) {
        await $flow.functions.deletePendingDataAction(
          $application.constants.appId,
          $application.variables.b2cAccountId,
          assessmentTempId,
          pendingDataAction,
          dataActionLocalDB
        );
      }

      assessment.pendingSync = false;

      return assessment;
    }
  }

  return ADVISOR_CREATE_ASSESSMENT_METADATA_BASED_ON_LOCAL_ASSESSMENT_CHAIN;
});
