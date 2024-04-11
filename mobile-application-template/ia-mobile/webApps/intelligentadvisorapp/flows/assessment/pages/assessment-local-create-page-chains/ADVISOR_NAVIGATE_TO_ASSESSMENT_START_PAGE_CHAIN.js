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

  class ADVISOR_NAVIGATE_TO_ASSESSMENT_START_PAGE_CHAIN extends ActionChain {

    /**
     * To navigate back to the previous page
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;

      await Actions.navigateBack(context, {
      });
    }
  }

  return ADVISOR_NAVIGATE_TO_ASSESSMENT_START_PAGE_CHAIN;
});
