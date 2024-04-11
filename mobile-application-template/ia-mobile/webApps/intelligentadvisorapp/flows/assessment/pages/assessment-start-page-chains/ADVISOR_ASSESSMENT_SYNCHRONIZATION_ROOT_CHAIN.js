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

  class ADVISOR_ASSESSMENT_SYNCHRONIZATION_ROOT_CHAIN extends ActionChain {

    /**
     * The root-level action chain for assessment synchronization
     * 
     * @param {Object} context
     * @param {Object} params
     * @param {boolean} params.pullToRefresh 
     * @param {boolean} params.forcedSync 
     */
    async run(context, { pullToRefresh = false, forcedSync = false }) {
      const { $page, $flow, $application } = context;

      if (pullToRefresh) {
        $page.variables.pullToRefreshStarted = true;
      }

      // Mark the synchronization in progress
      $page.variables.isSyncing = true;

      // Refresh the assessment list variable based on the locally persisted assessment data
      await Actions.callChain(context, {
        chain: 'ADVISOR_REFRESH_ASSESSMENT_LIST_FROM_LOCAL_CHAIN',
      });

      // To avoid VB bugs, we use a deep copy of the assessmentList variable
      // to perform synchronization and assign it back to the original assessmentList variable at the end
      let assessmentListForSync = JSON.parse(JSON.stringify($page.variables.assessmentList));

      if ($application.functions.isAppOnline()) {
        try {

          // sync offline records
          await Actions.callChain(context, {
            chain: 'ADVISOR_ASSESSMENT_SEND_OFFLINE_HIST_CHAIN'
          });

          // Load the missing assessments from BO, assign it back to assessmentListForSync to avoid VB bugs
          assessmentListForSync = await Actions.callChain(context, {
            chain: 'ADVISOR_LOAD_ASSESSMENT_FROM_BO_CHAIN',
            params: {
              assessmentList: assessmentListForSync,
            },
          });

          const initialDataSyncStatus = 
            await $application.functions.getDataSyncStatus(
              $application.constants.appId,
              $application.variables.b2cAccountId
            );

          if (forcedSync || !initialDataSyncStatus) {
            // Invoke the action chain to sync the local assessment metadata to the external, assign it back to assessmentListForSync to avoid VB bugs
            assessmentListForSync = await Actions.callChain(context, {
              chain: 'ADVISOR_SYNC_LOCAL_ASSESSMENT_PENDING_CHANGES_CHAIN',
              params: {
                assessmentList: assessmentListForSync,
              },
            });

            // Invoke the action chain to load the external assessment metadata and update accordingly, assign it back to assessmentListForSync to avoid VB bugs
            assessmentListForSync = await Actions.callChain(context, {
              chain: 'ADVISOR_SYNC_EXTERNAL_ASSESSMENT_METADATA_CHAIN',
              params: {
                assessmentList: assessmentListForSync,
              },
            });

            // Mark the initial data sync status as done
            await $application.functions.setDataSyncStatus(
              $application.constants.appId,
              $application.variables.b2cAccountId,
              true
            );
          }
        } catch (error) {
          // Notify the unexpected sync error to user
          await Actions.fireNotificationEvent(context, {
            summary: $application.translations.app.assessment_sync_unexpected_error_summary,
            displayMode: 'transient',
            type: 'error',
            message: `${error.name}: ${error.message}`,
          });
        }
      } else if (forcedSync) {
        // Warn the user that the synchronization cannot be done in offline environment
        await Actions.fireNotificationEvent(context, {
          summary: $application.translations.app.app_network_unavailable_summary,
          displayMode: 'transient',
          type: 'warning',
          message: $application.translations.app.assessment_sync_requires_network_message,
        });
      }

      // Update the original page variable assessmentList
      $page.variables.assessmentList = JSON.parse(JSON.stringify(assessmentListForSync));

      // Update the locally persisted assessment data
      await Actions.callChain(context, {
        chain: 'ADVISOR_PERSIST_ASSESSMENTS_LOCALLY_CHAIN',
      });

      // Update the assessment ADP
      await Actions.callChain(context, {
        chain: 'ADVISOR_REFRESH_ASSESSMENT_ADP_CHAIN',
      });

      // Mark the synchronization done
      $page.variables.isSyncing = false;

      if (pullToRefresh) {
        // Stopping the refresher after the process complete
        await $page.functions.concludeRefresher();

        $page.variables.pullToRefreshStarted = false;
      }
    }
  }

  return ADVISOR_ASSESSMENT_SYNCHRONIZATION_ROOT_CHAIN;
});
