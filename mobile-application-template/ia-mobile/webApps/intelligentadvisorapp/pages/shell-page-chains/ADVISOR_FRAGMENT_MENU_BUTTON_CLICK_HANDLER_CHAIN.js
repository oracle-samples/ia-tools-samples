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

  class ADVISOR_FRAGMENT_MENU_BUTTON_CLICK_HANDLER_CHAIN extends ActionChain {

    /**
     * To handle menu button cilck actions propagated from shell fragments
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.actionId 
     */
    async run(context, { actionId }) {
      const { $page, $flow, $application } = context;

      switch (actionId) {
        case "signout":
          await Actions.callChain(context, {
            chain: 'ADVISOR_LOG_OUT_CHAIN',
          });
          break;
        default:
          break;
      }
    }
  }

  return ADVISOR_FRAGMENT_MENU_BUTTON_CLICK_HANDLER_CHAIN;
});
