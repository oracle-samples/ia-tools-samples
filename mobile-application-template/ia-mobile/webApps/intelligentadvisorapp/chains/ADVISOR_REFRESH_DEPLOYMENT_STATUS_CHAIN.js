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

  class ADVISOR_REFRESH_DEPLOYMENT_STATUS_CHAIN extends ActionChain {

    /**
     * Action chain to refresh the local deployment statuses
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.intvSessionManagerElementId The HTML element ID for the oj-ia-intv-session-manager component in the current page.
     */
    async run(context, { intvSessionManagerElementId = 'ia-intv-session-manager' }) {
      const { $application } = context;

      let localDeployments = await $application.functions.getLocalDeploymentDetails($application.constants.appId);

      try {
        for (const localDeployment of localDeployments) {
          localDeployment.cachedLocally = await Actions.callComponentMethod(context, {
            selector: '#' + intvSessionManagerElementId,
            method: 'hasCachedFlowMetadata',
            params: [localDeployment.name],
          });
        }
      } catch (error) {
        await $application.functions.logError('global', error);
      }

      if ($application.functions.isAppOnline()) {
        const callRestIaHubApiGetIaDeploymentsResult = await Actions.callRest(context, {
          endpoint: 'iaHubApi/getIaDeployments',
          uriParams: {
            apiVersion: $application.constants.hubApiVersion,
          },
          responseBodyFormat: 'json',
          responseType: 'application:GetDeploymentsResponse',
        });

        if (!callRestIaHubApiGetIaDeploymentsResult.ok) {
          await Actions.callChain(context, {
            id: 'application:GLOBAL_ERROR_HANDLER_CHAIN',
            params: {
              response: callRestIaHubApiGetIaDeploymentsResult,
              type: $application.constants.errorTypes.getAllDeployments,
            },
          });
        } else {
          const refreshedLocalDeployments = localDeployments.filter((deployment) => deployment.cachedLocally === true);
          const cachedDeploymentNameSet = new Set(refreshedLocalDeployments.map((deployment) => deployment.name));

          const latestActiveDeployments = callRestIaHubApiGetIaDeploymentsResult.body.items
            .filter((item) => (typeof item.activeVersionNo === "number" && item.activeVersionNo > 0));

          for (const latestDeployment of latestActiveDeployments) {
            if (!cachedDeploymentNameSet.has(latestDeployment.name)) {
              refreshedLocalDeployments.push({
                name: latestDeployment.name,
                activeVersionNo: latestDeployment.activeVersionNo,
                cachedLocally: false
              });
            }
          }

          localDeployments = refreshedLocalDeployments;
        }
      }

      // Save the deployment details to the local storage
      await $application.functions.saveDeploymentDetailsLocally($application.constants.appId, localDeployments);

      // Update the deploymentList variable
      $application.variables.deploymentList = localDeployments;
    }
  }

  return ADVISOR_REFRESH_DEPLOYMENT_STATUS_CHAIN;
});
