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

  class ADVISOR_LIST_EXTERNAL_ASSESSMENT_METADATA_CHAIN extends ActionChain {

    /**
     * To list the external assessment metadata assigned to the current user
     * @param {Object} context
     * @param {Object} params
     * @param {string[]} params.statuses Statu filter
     * @param {string} params.externalId 
     * @return {object[]} 
     */
    async run(context, { statuses = [], externalId = '' }) {
      const { $page, $flow, $application } = context;

      // TODO: check what remote metadata source to use for the sync

      const externalAssessments = [];

      // Load external assessment metadata from B2C custom object
      let queryStatement = "SELECT Status.lookupName,Description,Deployment,ObjectID,id,Account "
        + "FROM OPA.MobileAssessment "
        + "WHERE Account.id=" + $application.variables.b2cAccountId;

      if (statuses.length > 0) {
        queryStatement = queryStatement + " AND Status.lookupName IN (" + statuses.map((status) => ("'" + status + "'")).join(", ") + ")";
      }

      if (externalId) {
        queryStatement = queryStatement + " AND id=" + externalId;
      }

      const callRestB2cRestApiGetListByQueryResult = await Actions.callRest(context, {
        endpoint: 'b2cRestApi/getListByQuery',
        uriParams: {
          query: queryStatement,
        },
      });

      if (!callRestB2cRestApiGetListByQueryResult.ok) {
        await Actions.callChain(context, {
          id: 'application:GLOBAL_ERROR_HANDLER_CHAIN',
          params: {
            response: callRestB2cRestApiGetListByQueryResult,
            type: $application.constants.errorTypes.getAllassessmentFromB2C,
          },
        });

        // Throw an error to distinguish from an empty result
        throw new Error(callRestB2cRestApiGetListByQueryResult.message?.summary);

      } else {
        // Convert the external assessment metadata fetched
        const responseData = callRestB2cRestApiGetListByQueryResult.body;
        if (responseData.items.length > 0) {
          const queryResults = responseData.items[0].rows;
          queryResults.forEach((item) => {
            externalAssessments.push({
              status: item[0],
              assessmentName: item[1],
              deploymentName: item[2],
              externalDataId: item[3],
              externalId: item[4].toString()
            });
          });
        }
      }

      return externalAssessments;
    }
  }

  return ADVISOR_LIST_EXTERNAL_ASSESSMENT_METADATA_CHAIN;
});
