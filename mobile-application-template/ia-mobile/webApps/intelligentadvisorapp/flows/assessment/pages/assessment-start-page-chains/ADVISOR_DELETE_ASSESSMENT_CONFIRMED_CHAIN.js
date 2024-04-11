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

  class ADVISOR_DELETE_ASSESSMENT_CONFIRMED_CHAIN extends ActionChain {

    /**
     * Action for delete confirmation "Yes"
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;

      // Close delete confirmation modal
      await $page.functions.closeConfirmation();

      // Perform the delete
      await Actions.callChain(context, {
        chain: 'ADVISOR_DELETE_ASSESSMENT_CHAIN',
      });
    }
  }

  return ADVISOR_DELETE_ASSESSMENT_CONFIRMED_CHAIN;
});
