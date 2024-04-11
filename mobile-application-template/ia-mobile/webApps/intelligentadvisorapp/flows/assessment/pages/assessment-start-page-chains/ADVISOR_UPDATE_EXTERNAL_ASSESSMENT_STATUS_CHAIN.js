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

  class ADVISOR_UPDATE_EXTERNAL_ASSESSMENT_STATUS_CHAIN extends ActionChain {

    /**
     * To update the assessment status stored in the remote metadata resource
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.externalId The assessment external identifier
     * @param {string} params.status The assessment status
     * @return {boolean} 
     */
    async run(context, { externalId, status }) {
      const { $page, $flow, $application } = context;

      const patchB2CAssessmentStatusResult = await Actions.callRest(context, {
        endpoint: 'b2cRestApi/patchOPAMobileAssessmentId',
        uriParams: {
          Id: externalId,
        },
        body: {
          "Status": {
            "lookupName": status
          }
        },
        responseBodyFormat: 'text',
      });

      if (!patchB2CAssessmentStatusResult.ok) {
        await Actions.callChain(context, {
          id: 'application:GLOBAL_ERROR_HANDLER_CHAIN',
          params: {
            response: patchB2CAssessmentStatusResult,
            type: $application.constants.errorTypes.b2cUpdateAssessment,
          },
        });
        return false;
      }

      return true;
    }
  }

  return ADVISOR_UPDATE_EXTERNAL_ASSESSMENT_STATUS_CHAIN;
});
