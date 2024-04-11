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

  class ADVISOR_DELETE_CACHED_LOCAL_DEPLOYMENT_CHAIN extends ActionChain {

    /**
     * To delete already cached flow from local
     * @param {Object} context
     * @param {Object} params
     * @param {number} params.index 
     * @param {application:DeploymentItem} params.currentDeploymentData 
     * @param {any} params.key 
     */
    async run(context, { index, currentDeploymentData, key }) {
      const { $page, $flow, $application } = context;

      const localDeployments = JSON.parse(JSON.stringify($application.variables.deploymentList));
      const targetDeployment = localDeployments.find((deployment) => deployment.name === currentDeploymentData.name);

      if (targetDeployment.cachedLocally) {
        await Actions.callComponentMethod(context, {
          selector: '#ia-session-manager-seed',
          method: 'deleteCachedFlowMetadata',
          params: [
            targetDeployment.name,
          ],
        });
        targetDeployment.cachedLocally = false;

        // Update the local storage
        await $application.functions.saveDeploymentDetailsLocally($application.constants.appId, localDeployments);
        // Update the app variable
        $application.variables.deploymentList = localDeployments;
      }
    }
  }

  return ADVISOR_DELETE_CACHED_LOCAL_DEPLOYMENT_CHAIN;
});
