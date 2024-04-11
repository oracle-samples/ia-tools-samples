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

  class ADVISOR_REFRESH_ACTIVE_DEPLOYMENT_LIST_CHAIN extends ActionChain {

    /**
     * To load active deployments from hub and update list
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;

      $page.variables.isListLoading = true;

      await Actions.callChain(context, {
        chain: 'application:ADVISOR_REFRESH_DEPLOYMENT_STATUS_CHAIN',
        params: {
          intvSessionManagerElementId: 'ia-session-manager-seed',
        },
      });

      $page.variables.isListLoading = false;
    }
  }

  return ADVISOR_REFRESH_ACTIVE_DEPLOYMENT_LIST_CHAIN;
});
