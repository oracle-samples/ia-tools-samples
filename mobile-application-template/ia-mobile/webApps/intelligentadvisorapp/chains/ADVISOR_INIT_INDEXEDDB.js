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

  class ADVISOR_INIT_INDEXEDDB extends ActionChain {

    /**
     * Initialize application's offline storage
     * 
     * @param {Object} context
     */
    async run(context) {
      const { $application } = context;

      try {
        // Initialize application's offline storage
        await $application.functions.initLocalDB();
      } catch (error) {
        await $application.functions.logError('global', error);
        throw error;
      }

    }
  }

  return ADVISOR_INIT_INDEXEDDB;
});
