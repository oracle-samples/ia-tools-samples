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

  class ADVISOR_LOG_OUT_CHAIN extends ActionChain {

    /**
     * IDCS user sign out chain
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;
      await $application.functions.setDataSyncStatus($application.constants.appId, $application.variables.b2cAccountId, false);

      await Actions.logout(context, {});
    }
  }

  return ADVISOR_LOG_OUT_CHAIN;
});
