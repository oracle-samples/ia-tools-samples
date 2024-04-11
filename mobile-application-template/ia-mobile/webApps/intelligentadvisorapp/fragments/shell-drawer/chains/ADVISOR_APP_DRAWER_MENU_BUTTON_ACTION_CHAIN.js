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

  class ADVISOR_APP_DRAWER_MENU_BUTTON_ACTION_CHAIN extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.actionId 
     */
    async run(context, { actionId }) {
      const { $fragment, $application } = context;

      const fireEventOnButtonActionResult = await Actions.fireEvent(context, {
        event: 'shellDrawerMenuButtonAction',
        payload: {
          actionId: actionId,
        },
      });
    }
  }

  return ADVISOR_APP_DRAWER_MENU_BUTTON_ACTION_CHAIN;
});
