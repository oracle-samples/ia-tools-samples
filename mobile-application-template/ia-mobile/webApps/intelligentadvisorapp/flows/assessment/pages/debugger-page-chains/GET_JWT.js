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

  class GET_JWT extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;
      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      console.log("=====jwt",urlParams)
      let jwt = urlParams.get('_iajwt');
      window.localStorage.setItem('debugJwt',jwt);
      console.log("=====jwt",jwt)
      // Navigation to this page can be canceled by returning an object with the property cancelled set to true. This is useful if the user does not have permission to view this page.
      return { cancelled: false };
    }
  }

  return GET_JWT;
});
