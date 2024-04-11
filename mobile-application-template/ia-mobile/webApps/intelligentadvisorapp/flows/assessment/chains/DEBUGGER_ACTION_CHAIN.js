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

  class DEBUGGER_ACTION_CHAIN extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {object} params.dataActionDetails 
     * @param {string} params.assessmentDetails 
     */
    async run(context, { dataActionDetails, assessmentDetails }) {
      const { $flow, $application } = context;

      const callChainOnGeolocationActionChain1Result = await Actions.callChain(context, {
        id: 'onGeolocationActionChain',
        params: {
          dataActionDetail: dataActionDetails,
        },
      });
    }
  }

  return DEBUGGER_ACTION_CHAIN;
});
