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

  class ADVISOR_FLOW_DATA_ACTION_CHAIN extends ActionChain {

    getNetworkRequirement(actionCustomProps) {
      if (typeof actionCustomProps['Network Requirement'] === 'string') {
        return actionCustomProps['Network Requirement'].replace(/\s/g, '').toLowerCase();
      } else if (typeof actionCustomProps.networkRequirement === 'string') {
        return actionCustomProps.networkRequirement.replace(/\s/g, '').toLowerCase();
      }

      return 'default';
    }

    getActionChainId(dataActionDetail, actionCustomProps) {
      return (actionCustomProps['Visual Builder Action Chain ID'] ?? actionCustomProps.vbActionChainId) || dataActionDetail.schemeId.replace(/[^a-zA-Z0-9_-]/g, '');
    }

    async handleDataActionAlwaysRequiringNetworkWhenOffline(context, assessmentDetail, dataActionDetail, actionCustomProps) {
      const { $flow, $application } = context;
  
      // The app is offline and the data action cannot be completed locally
      if (actionCustomProps['Wait for Return Data Before Continuing'] ?? actionCustomProps.synchronous) {
        // It is a "blocker" data action, so just fire a notification
        await Actions.fireNotificationEvent(context, {
          summary: $application.translations.app.device_is_offline_summary,
          message: $application.translations.app.assessment_requires_network_message,
          type: 'warning',
          displayMode: 'transient',
        });
      } else {
        await $flow.functions.addPendingDataAction(
          $application.constants.appId,
          $application.variables.b2cAccountId,
          assessmentDetail.id,
          dataActionDetail,
          await $application.functions.getLocalDataActionDB()
        );
      }
    }

    async getCachedDataKey(context, assessmentDetail, dataActionDetail, actionChainId, isExternalDataIdRequired) {
      const { $application } = context;

      // Determine the data cache key
      let dataCacheKey = $application.constants.appId + ':' + $application.variables.b2cAccountId + ':' + actionChainId;
      if (isExternalDataIdRequired) {
        dataCacheKey = dataCacheKey + ':' + assessmentDetail.externalDataId;
      } else {
        dataCacheKey = dataCacheKey + ':' + '__default_obj_id__';
      }
      // No sent data validation here. It is going to be implemented in the specific data action chain.
      if (dataActionDetail.sentData != null) {
        const sentDataHash = await $application.functions.hashCode(JSON.stringify(dataActionDetail.sentData));
        dataCacheKey = dataCacheKey + ':' + sentDataHash;
      }

      return dataCacheKey;
    }

    /**
     * Assessment flow data action handler chain.
     * 
     * @param {Object} context
     * @param {Object} params
     * @param {application:FlowDataActionProps} params.dataActionDetail
     * @param {application:AssessmentItem} params.assessmentDetail
     */
    async run(context, { dataActionDetail, assessmentDetail }) {
      const { $page, $flow, $application } = context;

      const actionCustomProps = dataActionDetail.customProperties;
      const isExternalDataIdRequired = actionCustomProps['Return Data Varies with External Identifier'] ?? actionCustomProps.objectIdRequired;

      if (isExternalDataIdRequired === true && assessmentDetail.externalDataId == null) {
        // Object ID is required but is actually missing
        await Actions.fireNotificationEvent(context, {
          message: $application.translations.app.assessment_missing_object_id_message,
          summary: $application.translations.app.assessment_missing_object_id_summary,
          displayMode: 'transient',
          type: 'warning',
        });
      }

      const isAppOnline = await $application.functions.isAppOnline();
      const networkRequirement = this.getNetworkRequirement(actionCustomProps);

      if (!isAppOnline && networkRequirement === 'always') {
        await this.handleDataActionAlwaysRequiringNetworkWhenOffline(context, assessmentDetail, dataActionDetail, actionCustomProps);
        // Return null as the data action result because the data action has not been completed
        return null;
      } else {
        // Determine action chain ID based on the data action custom property and scheme ID 
        const actionChainId = this.getActionChainId(dataActionDetail, actionCustomProps);
        let dataActionResult = null;
        if (networkRequirement === 'none' || networkRequirement === 'always') {
          // i.e., no cache needed
          try {
            dataActionResult = await Actions.callChain(context, {
              id: 'flow:' + actionChainId,
              params: {
                assessmentDetail: assessmentDetail,
                dataActionDetail: dataActionDetail
              }
            });
          } catch (error) {
            dataActionResult = $application.constants.defaultFailureString;
          }
        } else {
          // Determine the data cache key
          const dataCacheKey = await this.getCachedDataKey(context,
            assessmentDetail,
            dataActionDetail,
            actionChainId,
            isExternalDataIdRequired);

          // Get data action local DB
          const dataActionLocalDB = await $application.functions.getLocalDataActionDB();

          const cachedData = await $flow.functions.getCachedData(dataCacheKey, dataActionLocalDB);
          if (cachedData != null) {
            // Cache is available
            if (isAppOnline && networkRequirement !== 'cachefirst') {
              try {
                dataActionResult = await Actions.callChain(context, {
                  id: 'flow:' + actionChainId,
                  params: {
                    assessmentDetail: assessmentDetail,
                    dataActionDetail: dataActionDetail
                  }
                });
                if (dataActionResult == null) {
                  await $flow.functions.removeCachedData(dataCacheKey, dataActionLocalDB);
                } else {
                  await $flow.functions.setCachedData(dataCacheKey, dataActionResult, dataActionLocalDB);
                }
              } catch (error) {
                await $flow.functions.removeCachedData(dataCacheKey, dataActionLocalDB);
                dataActionResult = $application.constants.defaultFailureString;
              }
            } else {
              dataActionResult = cachedData;
            }
          } else { 
            // Cache is not available
            if (isAppOnline) {
              // No cache available but the app is online
              try {
                dataActionResult = await Actions.callChain(context, {
                  id: 'flow:' + actionChainId,
                  params: {
                    assessmentDetail: assessmentDetail,
                    dataActionDetail: dataActionDetail
                  }
                });
                if (dataActionResult != null) {
                  await $flow.functions.setCachedData(dataCacheKey, dataActionResult, dataActionLocalDB);
                }
              } catch (error) {
                dataActionResult = $application.constants.defaultFailureString;
              }
            } else {
              // No cache available and the app is offline
              await Actions.fireNotificationEvent(context, {
                summary: $application.translations.app.device_is_offline_summary,
                message: $application.translations.app.assessment_requires_network_message,
                type: 'warning',
                displayMode: 'transient',
              });
            }
          }
        }

        if (dataActionResult == null && dataActionDetail.returnedDataDefinition != null) {
          // Something was wrong. The returned data is not available.
          dataActionResult = $application.constants.defaultFailureString;
        }

        return dataActionResult;
      }
    }
  }

  return ADVISOR_FLOW_DATA_ACTION_CHAIN;
});
