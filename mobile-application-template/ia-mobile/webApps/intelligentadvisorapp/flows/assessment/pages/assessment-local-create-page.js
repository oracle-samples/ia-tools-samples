/**
 * Copyright © 2023, Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
define([], () => {
  'use strict';

  class PageModule {
    constructor(context) {
      this.eventHelper = context.getEventHelper();
    }
  }

  return PageModule;
});
