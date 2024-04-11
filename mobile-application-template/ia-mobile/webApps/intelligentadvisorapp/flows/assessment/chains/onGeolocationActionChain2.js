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

  class onGeolocationActionChain2 extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {application:FlowDataActionProps} params.dataActionDetails 
     */
    async run(context, { dataActionDetails = {} }) {
      const { $flow, $application } = context;

      const callFunctionResult = await $flow.functions.getGeolocationCoords(dataActionDetails.geolocation);

      return callFunctionResult;
    }
  }

  return onGeolocationActionChain2;
});
