/**
 * Copyright © 2023, Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
define([], () => {
  'use strict';

  class PageModule {

    constructor(context) {
      this.eventHelper = context.getEventHelper();
      this.promiseResolver = {};
    }

    openConfirmation() {
      document.getElementById('oj-dialog-delete-assesment-confirmation').open();
    }

    closeConfirmation() {
      document.getElementById('oj-dialog-delete-assesment-confirmation').close();
    }

    getRefreshFunction() {
      return this.checkForUpdates.bind(this);
    }

    checkForUpdates() {
      let myPromise = new Promise((resolve, reject) => {
        this.promiseResolver.resolveHandler = resolve;
      });

      // raise a check for refresh event and refresh the data set 
      // from the action chain associated with the event
      this.eventHelper.fireCustomEvent("customRefreshContentsEvent");
      return myPromise;
    }

    concludeRefresher() {
      // data refreshed, resolve the promise now
      this.promiseResolver.resolveHandler();
    }

  }

  return PageModule;
});
