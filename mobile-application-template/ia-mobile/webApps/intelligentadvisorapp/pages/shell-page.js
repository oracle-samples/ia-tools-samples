/**
 * Copyright © 2023, Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
define([
    'ojs/ojresponsiveknockoututils',
    'ojs/ojresponsiveutils'],
  (
    ResponsiveKnockoutUtils,
    ResponsiveUtils
  ) => {
  'use strict';

  class PageModule {
    toggleDrawer() {
      const drawer = document.querySelector('#navDrawer');
      drawer.startOpened = !drawer.startOpened;
      return drawer.startOpened;
    }
  }

  // If the drawer is open and the page gets resized close it on small screens
  const smQuery = ResponsiveUtils.getFrameworkQuery(ResponsiveUtils.FRAMEWORK_QUERY_KEY.SM_ONLY);
  const smScreen = ResponsiveKnockoutUtils.createMediaQueryObservable(smQuery);
  smScreen.subscribe(() => {
    // if we are transitioning into the small screen close the drawer
    if (smScreen()) {
      document.querySelector('#navDrawer').startOpened = false;
    }
  });

  return PageModule;
});