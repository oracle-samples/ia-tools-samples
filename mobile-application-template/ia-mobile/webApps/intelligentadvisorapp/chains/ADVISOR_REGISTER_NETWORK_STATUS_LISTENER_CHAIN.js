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

  class ADVISOR_REGISTER_NETWORK_STATUS_LISTENER_CHAIN extends ActionChain {

    /**
     * Register a network status listener on the current page
     * @param {Object} context
     */
    async run(context) {
      const { $application } = context;

      const networkStatus = navigator.onLine ? "online" : "offline";
      window.localStorage.setItem("networkStatus", networkStatus);

      await $application.functions.logData(`The app is ${networkStatus}.`);

      window.addEventListener("online", async () => {
        window.localStorage.setItem("networkStatus", "online");

        await $application.functions.logData("The app has become online.");
      });

      window.addEventListener("offline", async () => {
        window.localStorage.setItem("networkStatus", "offline");

        await $application.functions.logData("The app has become offline.");
      });

      await Actions.fireEvent(context, {
        event: 'networkListenerRegistered',
      });
    }
  }

  return ADVISOR_REGISTER_NETWORK_STATUS_LISTENER_CHAIN;
});
