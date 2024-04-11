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

  class ADVISOR_CLOSE_FLOW_NAVIGATION_CHAIN extends ActionChain {

    /**
     * To close the opened flow navigation drawer
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;

      const flowNavigationElement = document.getElementById('plain-drawer-layout');

      if (flowNavigationElement) {
        flowNavigationElement.setProperty('startOpened', false);
      } else {
        await $application.functions.logWarning('assessment-detail', 'Cannot locate the flow navigation drawer when trying to close it.');
      }
    }
  }

  return ADVISOR_CLOSE_FLOW_NAVIGATION_CHAIN;
});
