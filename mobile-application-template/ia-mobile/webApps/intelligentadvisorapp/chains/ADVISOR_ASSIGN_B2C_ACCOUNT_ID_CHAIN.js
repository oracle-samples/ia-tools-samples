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

  class ADVISOR_ASSIGN_B2C_ACCOUNT_ID_CHAIN extends ActionChain {

    /**
     * Assign the global variable b2cAccountId based on the IDCS user information
     * @param {Object} context
     */
    async run(context) {
      const { $application } = context;

      if ($application.constants.b2cUserMatchFields.length === 0) {
        // No matcher is provided, make sure the variable is reset back to default
        await Actions.resetVariables(context, {
          variables: [
            '$application.variables.b2cAccountId',
          ],
        });
      }

      if ($application.functions.isAppOnline()) {
        for (const matcher of $application.constants.b2cUserMatchFields) {
          if (matcher) {
            let queryString;
            if (matcher.toLowerCase() === 'email') {
              queryString = "emails.address='" + ($application.user.email || $application.user.username) + "'";
            } else if (matcher.toLowerCase() === 'lookupname') {
              queryString = "lookupName='" + $application.user.fullName + "'";
            } else {
              continue;
            }

            const restSearchAccountsResult = await Actions.callRest(context, {
              endpoint: 'b2cRestApi/getAccounts',
              responseBodyFormat: 'json',
              uriParams: {
                q: queryString,
              },
              responseType: 'application:B2CGetManyResponse'
            });

            if (!restSearchAccountsResult.ok) {
              await Actions.callChain(context, {
                id: 'application:GLOBAL_WARNING_HANDLER_CHAIN',
                params: {
                  type: 'b2cGetAccountFailed',
                },
              });
            
              $application.variables.b2cAccountId = -127;
              return;
            }

            const accountMatches = restSearchAccountsResult.body.items;
            if (Array.isArray(accountMatches) && accountMatches.length > 0 && typeof accountMatches[0].id === 'number') {
              $application.variables.b2cAccountId = accountMatches[0].id;
              break;
            } else {
              $application.variables.b2cAccountId = -127;
            }
          }
        }
      }
    }
  }

  return ADVISOR_ASSIGN_B2C_ACCOUNT_ID_CHAIN;
});
