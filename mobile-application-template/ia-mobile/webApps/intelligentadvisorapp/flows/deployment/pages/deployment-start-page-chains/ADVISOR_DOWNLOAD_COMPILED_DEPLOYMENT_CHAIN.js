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

  class ADVISOR_DOWNLOAD_COMPILED_DEPLOYMENT_CHAIN extends ActionChain {

    /**
     * Download selected flow from given hub and save to local
     * @param {Object} context
     * @param {Object} params
     * @param {application:DeploymentItem} params.currentDeployment 
     * @param {number} params.index 
     * @param {any} params.key 
     */
    async run(context, { currentDeploymentData, index, key }) {
      const { $page, $flow, $application } = context;

      if (await $application.functions.isAppOnline()) {
        $page.variables.isDeploymentSaving = true;
        $page.variables.currentDeploymentIndex = index;

        // Deep copy of the variable deploymentList
        const localDeployments = JSON.parse(JSON.stringify($application.variables.deploymentList));
        let targetIndex = -1;
        let targetDeployment;
        for (let i = 0; i < localDeployments.length; i++) {
          if (localDeployments[i].name === currentDeploymentData.name) {
            targetIndex = i;
            targetDeployment = localDeployments[i];
            break;
          }
        }

        let deploymentListUpdateRequired = false;

        // Obtain a new flow start JWT for the deployment
        const callRestIaHubApiIaFlowStartResult = await Actions.callRest(context, {
          endpoint: 'iaHubApi/iaFlowStart',
          body: {
            action: 'startOrResume',
            deployment: targetDeployment.name,
          },
        });

        if (!callRestIaHubApiIaFlowStartResult.ok) {
          if (callRestIaHubApiIaFlowStartResult.status === 400) {
            // The deployment probably does not exist in the hub anymore
            await Actions.fireNotificationEvent(context, {
              displayMode: 'transient',
              type: 'error',
              summary: $application.translations.format('app', 'deployment_not_available_in_hub_summary', { deploymentName: targetDeployment.name }),
            });
            if (!targetDeployment.cachedLocally) {
              localDeployments.splice(targetIndex, 1);
              deploymentListUpdateRequired = true;
            }
          } else {
            await Actions.callChain(context, {
              id: 'application:GLOBAL_ERROR_HANDLER_CHAIN',
              params: {
                response: callRestIaHubApiIaFlowStartResult,
                type: $application.constants.errorTypes.startSession,
              },
            });
          }
        } else {
          try {
            await Actions.callComponentMethod(context, {
              selector: '#ia-session-manager-seed',
              method: 'cacheFlowMetadata',
              params: [
                targetDeployment.name,
                callRestIaHubApiIaFlowStartResult.body.jwt
              ],
            });

            if (!targetDeployment.cachedLocally) {
              targetDeployment.cachedLocally = true;
              deploymentListUpdateRequired = true;
            }
          } catch (error) {
            await Actions.fireNotificationEvent(context, {
              displayMode: 'transient',
              type: 'error',
              summary: $application.translations.format('app', 'deployment_cache_failure_summary', { deploymentName: targetDeployment.name }),
              message: error.message || '',
            });
          }
        }

        if (deploymentListUpdateRequired) {
          // Update the local storage
          await $application.functions.saveDeploymentDetailsLocally($application.constants.appId, localDeployments);
          // Update the app variable
          $application.variables.deploymentList = localDeployments;
        }

        $page.variables.isDeploymentSaving = false;

      } else {
        await Actions.fireNotificationEvent(context, {
          displayMode: 'transient',
          type: 'warning',
          summary: $application.translations.app.device_is_offline_summary,
        });
      }
    }
  }

  return ADVISOR_DOWNLOAD_COMPILED_DEPLOYMENT_CHAIN;
});
