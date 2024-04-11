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

    class ADVISOR_ASSESSMENT_SEND_OFFLINE_HIST_CHAIN extends ActionChain {

        /**
         * Send offline history to the hub
         * @param {Object} context
         */
        async run(context) {
            const { $page, $flow, $application } = context;
            const records = await $application.functions.getAllIASessionHistoryRecords();
            if (records && records.length >0) {
                const response = await Actions.callRest(context, {
                    endpoint: 'iaHubApi/flowRecordOffline',
                    body: JSON.stringify(records)
                });

                await $application.functions.clearIASessionHistoryRecords(records.map(record=>record.sessionJWT));
            }
        }
    }

    return ADVISOR_ASSESSMENT_SEND_OFFLINE_HIST_CHAIN;
});