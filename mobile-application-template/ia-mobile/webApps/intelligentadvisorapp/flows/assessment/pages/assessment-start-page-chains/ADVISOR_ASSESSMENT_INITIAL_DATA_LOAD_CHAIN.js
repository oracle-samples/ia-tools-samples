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

  class ADVISOR_ASSESSMENT_INITIAL_DATA_LOAD_CHAIN extends ActionChain {

    /**
     * Load external data into assessment flow model based on flow's initial data actions
     * @param {Object} context
     * @param {Object} params
     * @param {flow:LocalAssessmentItem} params.assessmentDetail 
     */
    async run(context, { assessmentDetail }) {
      const { $page, $flow, $application } = context;

      // Get a new flow start JWT
      const flowStartJwt = await Actions.callChain(context, {
        chain: 'flow:ADVISOR_FLOW_TOKEN_FETCH_CHAIN',
        params: {
          assessmentDetail: assessmentDetail,
        },
      });

      if (!flowStartJwt) {
        return;
      }

      const offlineMode = $application.constants.useCachedFlow.toLowerCase() === 'always';

      try {
        let sessionDetail = await Actions.callComponentMethod(context, {
          selector: '#ia-session-manager-seed',
          method: offlineMode ? 'startFlowSessionOffline' : 'startFlowSession',
          params: [
            assessmentDetail.deploymentName,
            flowStartJwt
          ],
        });
        let sessionState = sessionDetail.currentIaSession;
        let currentPosition = sessionDetail.currentPosition;
        const currentVisited = [];

        while (true) {
          // Try getting the data action detail on the current position
          let dataActionDetail = await Actions.callComponentMethod(context, {
            selector: '#ia-session-manager-seed',
            method: offlineMode ? 'runDataActionOffline' : 'runDataAction',
            params: [
              assessmentDetail.deploymentName,
              flowStartJwt,
              sessionState,
              currentPosition
            ],
          });

          if (!dataActionDetail) {
            // The current position is not a data action, we stop here
            break;
          }

          // Invoke the flow-level action chain for the data action
          let dataActionReturnedData = await Actions.callChain(context, {
            chain: 'flow:ADVISOR_FLOW_DATA_ACTION_CHAIN',
            params: {
              assessmentDetail: assessmentDetail,
              dataActionDetail: dataActionDetail
            }
          });

          if (dataActionReturnedData === $application.constants.defaultFailureString) {
            // The current data action process failed. Stop further processing.
            break;
          }

          // If the data action returns data, we pass it back to the assessment flow
          if (dataActionReturnedData) {
            const setReturnedDataResult = await Actions.callComponentMethod(context, {
              selector: '#ia-session-manager-seed',
              method: offlineMode ? 'setDataActionReturnedDataOffline' : 'setDataActionReturnedData',
              params: [
                assessmentDetail.deploymentName,
                flowStartJwt,
                sessionState,
                currentPosition,
                dataActionDetail.controlId,
                dataActionReturnedData
              ],
            });

            // Refresh the session state
            sessionState = setReturnedDataResult.currentIaSession;
            currentPosition = setReturnedDataResult.currentPosition;
          }

          // Mark the visited data action
          currentVisited.push(dataActionDetail.controlId);

          // Go to the next flow position
          currentPosition++;
        }

        // Save the session state to the local storage
        await $flow.functions.saveAssessmentSessionLocally(
          assessmentDetail.id,
          {
            currentIaSession: sessionState,
            currentPosition: currentPosition,
            currentVisited: currentVisited
          },
          $application.constants.appId,
          await $application.functions.getLocalAssessmentDB()
        );
      } catch (error) {
        await Actions.fireNotificationEvent(context, {
          summary: $application.translations.app.assessment_sync_initial_data_action_failure_summary,
          message: $application.translations.format('app', 'assessment_sync_initial_data_action_failure_message', { assessmentName: assessmentDetail.assessmentName, message: error.message }),
          displayMode: 'transient',
        });
      }
    }
  }

  return ADVISOR_ASSESSMENT_INITIAL_DATA_LOAD_CHAIN;
});
