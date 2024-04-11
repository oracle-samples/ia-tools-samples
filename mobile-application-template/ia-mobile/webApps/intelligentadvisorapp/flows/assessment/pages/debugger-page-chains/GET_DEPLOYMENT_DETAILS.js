
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

  class GET_DEPLOYMENT_DETAILS extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $flow, $application } = context;

      $page.variables.isPageLoaded = false;
      const debugJWT = window.localStorage.getItem('debugJwt');

      const callFunctionResult = await this.parseJWT(context, { token: debugJWT });
      console.log('======callFunctionResult', callFunctionResult)
      const projectDetails = JSON.parse(callFunctionResult.sub);
      console.log('=====projectDetails', projectDetails);
      $page.variables.jwt = debugJWT;
      $page.variables.flowName = projectDetails.project;

      const callRestBusinessObjectsGetallDeploymentsForDebugResult = await Actions.callRest(context, {
        endpoint: 'businessObjects/getall_DeploymentsForDebug',
      });
      console.log('callRestBusinessObjectsGetallDeploymentsForDebugResult', callRestBusinessObjectsGetallDeploymentsForDebugResult);
      const deploymentDetails = callRestBusinessObjectsGetallDeploymentsForDebugResult.body.items.find((item) => item.deploymentName === $page.variables.flowName);
      
      $page.variables.deploymentDetails = deploymentDetails||{};

      $page.variables.isPageLoaded = true;
    }

    /**
     * @param {Object} context
     * @return {string} 
     */
    async getJwt(context) {
      const { $page, $flow, $application } = context;
      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      console.log("=====jwt", urlParams)
      let jwt = urlParams.get('_iajwt');
      console.log("=====jwt", jwt)
      return jwt;

    }

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.token 
     */
    async parseJWT(context, { token }) {
      const { $page, $flow, $application } = context;
      var base64Url = token.split('.')[1];
      var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      return JSON.parse(jsonPayload);
    }
  }

  return GET_DEPLOYMENT_DETAILS;
});
