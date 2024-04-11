/**
 * Copyright © 2023, Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
define([
  'vb/action/actionChain',
  'vb/action/actions',
  'vb/action/actionUtils',
  'vb/helpers/rest'
], (
  ActionChain,
  Actions,
  ActionUtils,
  Rest
) => {
  'use strict';

  class ADVISOR_ASSIGN_IA_SITE_URL_CHAIN extends ActionChain {

    /**
     * Assign the global variable iaSiteUrl from IA Hub service connection information
     * @param {Object} context
     */
    async run(context) {
      const { $application } = context;

      const iaDeploymentUrl = await Rest.get('iaHubApi/getIaDeployments').toUrl();
      $application.variables.iaSiteUrl = iaDeploymentUrl.substring(8, iaDeploymentUrl.indexOf('/opa-hub'));
    }
  }

  return ADVISOR_ASSIGN_IA_SITE_URL_CHAIN;
});
