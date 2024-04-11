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

  class ADVISOR_LOAD_ASSESSMENT_DETAIL_CHAIN extends ActionChain {

    /**
     * To load the full assessment detail in advance for assessment-detail page rendering
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;

      // Hide the oj-ia-intv component initially
      $page.variables.showContent = false;

      const assessmentLocalDB = await $application.functions.getLocalAssessmentDB();

      // Update the assessmentDetails variable
      $page.variables.assessmentDetails = await $flow.functions.getAssessmentDetailsLocally(
        $application.constants.appId,
        $application.variables.b2cAccountId,
        $page.variables.assessmentId,
        assessmentLocalDB
      );

      if (typeof $page.variables.assessmentDetails.id !== 'number') {
        // No valid local assessment detail
        if ($application.functions.isAppOnline()) {
          // Try to get it from BO
          const callRestBusinessObjectsGetAssessmentsResult = await Actions.callRest(context, {
            endpoint: 'businessObjects/get_Assessments',
            uriParams: {
              'Assessments_Id': String($page.variables.assessmentId),
            },
            responseBodyFormat: 'json',
            responseType: 'application:AssessmentItem',
          });

          if (callRestBusinessObjectsGetAssessmentsResult.ok) {
            const boAssessment = callRestBusinessObjectsGetAssessmentsResult.body;
            $page.variables.assessmentDetails = {
              ...boAssessment,
              pendingSync: false
            };

            await $flow.functions.saveAssessmentDetailsLocally(
              $application.constants.appId,
              $page.variables.assessmentDetails,
              assessmentLocalDB
            );
          }
        }
      }

      if (typeof $page.variables.assessmentDetails.id !== 'number') {
        // No assessment detail available
        await Actions.navigateToFlow(context, {
          target: 'parent',
          flow: 'assessment',
          page: 'assessment-start',
        });
      } else {
        if ($page.variables.assessmentDetails.status === 'In Progress' ||
          ($page.variables.assessmentDetails.status === 'Complete' && $application.constants.useConfirmationPage)) {

          if ($application.functions.isAppOnline() && !$page.variables.offlineMode) {
            // Get a new flow start JWT token
            const flowStartJwt = await Actions.callChain(context, {
              chain: 'flow:ADVISOR_FLOW_TOKEN_FETCH_CHAIN',
              params: {
                assessmentDetail: $page.variables.assessmentDetails,
              },
            });

            if (flowStartJwt) {
              // Update the flow token object variable with the latest flow start JWT returned
              $page.variables.flowTokenDetails = {
                sessionJwt: flowStartJwt
              };
            } else {
              // Navigate back to the assessment list page
              await Actions.navigateToFlow(context, {
                target: 'parent',
                flow: 'assessment',
                page: 'assessment-start',
              });
            }
          } else {
            const flowCached = await Actions.callComponentMethod(context, {
              selector: '#ia-intv-session-manager',
              method: 'hasCachedFlowMetadata',
              params: [$page.variables.assessmentDetails.deploymentName],
            });

            if (!flowCached) {
              await Actions.fireNotificationEvent(context, {
                displayMode: 'transient',
                type: 'error',
                summary: $application.translations.format('app', 'deployment_not_locally_available_summary', { deploymentName: $page.variables.assessmentDetails.deploymentName }),
                message: $application.translations.app.app_is_offline_or_in_offline_flow_mode_message,
              });

              // Navigate back to the assessment list page
              await Actions.navigateToFlow(context, {
                target: 'parent',
                flow: 'assessment',
                page: 'assessment-start',
              });
            }
          }

          // Load the assessment's saved session
          $page.variables.currentIaSessionDetails = await $flow.functions.getLocalAssessmentSession(
            $page.variables.assessmentDetails.id,
            $application.constants.appId,
            assessmentLocalDB
          );

          // Show the oj-ia-intv component 
          $page.variables.showContent = true;

        } else {
          // Local assessment detail in a wrong status
          await Actions.fireNotificationEvent(context, {
            displayMode: 'transient',
            type: 'warning',
            summary: $application.translations.app.assessment_detail_not_editable_dialog_title,
            message: $application.translations.app.assessment_detail_not_editable_dialog_message,
          });

          // Navigate back to the assessment list page
          await Actions.navigateToFlow(context, {
            target: 'parent',
            flow: 'assessment',
            page: 'assessment-start',
          });
        }

      }
    }
  }

  return ADVISOR_LOAD_ASSESSMENT_DETAIL_CHAIN;
});
