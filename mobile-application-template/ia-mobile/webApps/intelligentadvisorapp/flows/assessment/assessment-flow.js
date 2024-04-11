/**
 * Copyright © 2023, Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
define([], () => {
  'use strict';

  class FlowModule {
    // ASSESSMENT SESSION

    /**
     * 
     * @param {Number} assessmentId
     * @param {String} appId
     */
    getLocalAssessmentSessionKey(assessmentId, appId) {
      return appId + ":Assessment_" + assessmentId;
    }

    /**
     *
     * @param {Number} assessmentId
     * @param {Object} session
     * @param {String} appId
     * @param {Object} assessmentLocalDB
     */
    async saveAssessmentSessionLocally(assessmentId, session, appId, assessmentLocalDB) {
      await assessmentLocalDB.setItemAsync(this.getLocalAssessmentSessionKey(assessmentId, appId), session);
    }

    /**
     *
     * @param {Number} assessmentId
     * @param {String} appId
     * @param {Object} assessmentLocalDB
     * @return {Object}
     */
    async getLocalAssessmentSession(assessmentId, appId, assessmentLocalDB) {
      return (await assessmentLocalDB.getItemAsync(this.getLocalAssessmentSessionKey(assessmentId, appId))) ?? {};
    }

    /**
     *
     * @param {Number} assessmentId
     * @param {String} appId
     * @param {Object} assessmentLocalDB
     */
    async deleteLocalAssessmentSession(assessmentId, appId, assessmentLocalDB) {
      await assessmentLocalDB.removeItemAsync(this.getLocalAssessmentSessionKey(assessmentId, appId));
    }

    // ASSESSMENT METADATA DETAILS

    /**
     * 
     * @param {String} appId
     * @param {Number} userId
     */
    getLocalAssessmentDetailsKey(appId, userId) {
      return appId + ":" + userId + ":offlineSavedAssessmentList";
    }

    /**
     *
     * @param {String} appId
     * @param {Object} assessmentDetail
     * @param {Object} assessmentLocalDB
     */
    async saveAssessmentDetailsLocally(appId, assessmentDetail, assessmentLocalDB) {
      const offlineAssessmentsKey = this.getLocalAssessmentDetailsKey(appId, assessmentDetail.userId);
      let localAssesments = (await assessmentLocalDB.getItemAsync(offlineAssessmentsKey)) ?? [];
      localAssesments.push(assessmentDetail);
      await assessmentLocalDB.setItemAsync(offlineAssessmentsKey, localAssesments);
    }

    /**
     *
     * @param {String} appId
     * @param {Number} userId
     * @param {Array} assessmentList
     * @param {Object} assessmentLocalDB
     */
    async refreshAllAssessmentDetailsLocally(appId, userId, assessmentList, assessmentLocalDB) {
      await assessmentLocalDB.setItemAsync(this.getLocalAssessmentDetailsKey(appId, userId), assessmentList);
    }

    /**
     *
     * @param {String} appId
     * @param {Number} userId
     * @param {Number} assessmentId
     * @param {Object} assessmentLocalDB
     * @return {Object}
     */
    async getAssessmentDetailsLocally(appId, userId, assessmentId, assessmentLocalDB) {
      return (await this.getLocalAssessmentDetailList(appId, userId, assessmentLocalDB)).find((assessment) => (assessment.id === assessmentId)) ?? {};
    }

    /**
     *
     * @param {String} appId
     * @param {Number} userId
     * @param {Object} assessmentLocalDB
     * @return {Object}
     */
    async getLocalAssessmentDetailList(appId, userId, assessmentLocalDB) {
      return (await assessmentLocalDB.getItemAsync(this.getLocalAssessmentDetailsKey(appId, userId))) ?? [];
    }

    /**
     * Update an existing assessment in the local storage
     * 
     * @param {Object} updatedAssessmentDetails
     * @param {String} appId
     * @param {Number} userId
     * @param {Object} assessmentLocalDB
     */
    async updateLocalAssessmentDetails(updatedAssessmentDetails, appId, userId, assessmentLocalDB) {
      const localAssessments = await this.getLocalAssessmentDetailList(appId, userId, assessmentLocalDB);
      for (let i = 0; i < localAssessments.length; i++) {
        const localAssessment = localAssessments[i];
        if (localAssessment.id === updatedAssessmentDetails.id) {
          localAssessments[i] = updatedAssessmentDetails;
          break;
        }
      }
      // Persist it back to local DB
      await assessmentLocalDB.setItemAsync(this.getLocalAssessmentDetailsKey(appId, userId), localAssessments);
    }

    // DATA ACTION DATA CACHE

    /**
     *
     * @param {String} dataCacheKey
     * @param {Object} dataActionLocalDB
     * @return {String}
     */
    async getCachedData(dataCacheKey, dataActionLocalDB) {
      return dataActionLocalDB.getItemAsync(dataCacheKey);
    }

    /**
     *
     * @param {String} dataCacheKey
     * @param {Any} dataActionResult
     * @param {Object} dataActionLocalDB
     */
    async setCachedData(dataCacheKey, dataActionResult, dataActionLocalDB) {
      await dataActionLocalDB.setItemAsync(dataCacheKey, dataActionResult);
    }

    /**
     *
     * @param {String} dataCacheKey
     * @param {Object} dataActionLocalDB
     * @return {String}
     */
    async removeCachedData(dataCacheKey, dataActionLocalDB) {
      await dataActionLocalDB.removeItemAsync(dataCacheKey, dataActionLocalDB);
    }

    // PENDING DATA ACTION

    /**
     * 
     * @param {String} appId
     * @param {Number} userId
     * @param {Any} assessmentId
     * @return {String}
     */
    getPendingDataActionKeyPrefix(appId, userId, assessmentId) {
      return appId + ":" + userId + ":pendingDataActions:" + assessmentId + ":";
    }

    /**
     * 
     * @param {String} appId
     * @param {Number} userId
     * @param {Any} assessmentId
     * @param {Any} dataActionDetail
     * @return {String}
     */
    getPendingDataActionKey(appId, userId, assessmentId, dataActionDetail) {
      return this.getPendingDataActionKeyPrefix(appId, userId, assessmentId) + dataActionDetail.controlId;
    }

    /**
     * 
     * @param {String} appId
     * @param {Number} userId
     * @param {Any} assessmentId
     * @return {Array}
     */
    getAllPendingDataActionKeys(appId, userId, assessmentId) {
      const keys = [];
      const pendingDataActionKeyPrefix = this.getPendingDataActionKeyPrefix(appId, userId, assessmentId);
      for (const localStorageKey of Object.keys(window.localStorage)) {
        if (localStorageKey.startsWith(pendingDataActionKeyPrefix)) {
          keys.push(localStorageKey);
        }
      }
      return keys;
    }

    /**
     * 
     * @param {String} appId
     * @param {Number} userId
     * @param {Any} assessmentId
     * @param {Any} dataActionDetail
     * @param {Object} dataActionLocalDB
     */
    async addPendingDataAction(appId, userId, assessmentId, dataActionDetail, dataActionLocalDB) {
      const pendingDataActionKey = this.getPendingDataActionKey(appId, userId, assessmentId, dataActionDetail);
      await dataActionLocalDB.setItemAsync(pendingDataActionKey, dataActionDetail);
      // Maintain a "key index" in local storage, might consider using IDBKeyRange later
      window.localStorage.setItem(pendingDataActionKey, dataActionDetail.controlId);
    }

    /**
     * 
     * @param {String} appId
     * @param {Number} userId
     * @param {Any} assessmentId
     * @param {Array} dataActions
     * @param {Object} dataActionLocalDB
     */
    async addAllPendingDataActions(appId, userId, assessmentId, dataActions, dataActionLocalDB) {
      for (const dataActionDetail of dataActions) {
        await this.addPendingDataAction(appId, userId, assessmentId, dataActionDetail, dataActionLocalDB);
      }
    }

    /**
     * 
     * @param {String} appId
     * @param {Number} userId
     * @param {Any} assessmentId
     * @param {Object} dataActionLocalDB
     */
    async getAllPendingDataActions(appId, userId, assessmentId, dataActionLocalDB) {
      const pendingDataActions = [];
      const pendingDataActionKeys = this.getAllPendingDataActionKeys(appId, userId, assessmentId);

      for (const pendingDataActionKey of pendingDataActionKeys) {
        pendingDataActions.push(await dataActionLocalDB.getItemAsync(pendingDataActionKey));
      }

      return pendingDataActions;
    }

    /**
     * 
     * @param {String} appId
     * @param {Number} userId
     * @param {Any} assessmentId
     * @param {Any} dataActionDetail
     * @param {Object} dataActionLocalDB
     */
    async deletePendingDataAction(appId, userId, assessmentId, dataActionDetail, dataActionLocalDB) {
      const pendingDataActionKey = this.getPendingDataActionKey(appId, userId, assessmentId, dataActionDetail);
      // Delete the "key index" in local storage, might consider using IDBKeyRange later
      window.localStorage.removeItem(pendingDataActionKey);
      await dataActionLocalDB.removeItemAsync(pendingDataActionKey);
    }

    /**
     * 
     * @param {String} appId
     * @param {Number} userId
     * @param {Any} assessmentId
     * @param {Object} dataActionLocalDB
     */
    async deleteAllPendingDataActions(appId, userId, assessmentId, dataActionLocalDB) {
      const pendingDataActionKeys = this.getAllPendingDataActionKeys(appId, userId, assessmentId);

      for (const pendingDataActionKey of pendingDataActionKeys) {
        // Delete the "key index" in local storage, might consider using IDBKeyRange later
        window.localStorage.removeItem(pendingDataActionKey);
        await dataActionLocalDB.removeItemAsync(pendingDataActionKey);
      }
    }

    /**
     * Check if any assessment in the given assessment list is pending synchronization
     * 
     * @param {Array} assessmentList
     * @return {Boolean}
     */
    hasAssessmentsPendingSync(appId, userId, assessmentList) {
      const detailChangePendingSync = assessmentList.some((assessment) => assessment.pendingSync === true);

      if (detailChangePendingSync) {
        return true;
      } else {
        for (const assessment of assessmentList) {
          if (this.getAllPendingDataActionKeys(appId, userId, assessment.id).length > 0) {
            return true;
          }
        }
      }

      return false;
    }

    // DATA ACTION RELATED HELPER FUNCTIONS

    /**
     *
     * @param {array} fileList
     * @return {object}
     */
    getFileContents(fileList) {
      const fileNameArr = fileList.map((file) => ({
        name: file.name,
        content: file.content
      }));
      return ({
        files: fileNameArr
      });
    }

    /**
     *
     * @param {any} geolocation
     * @return {Object}
     */
    getGeolocationCoords(geolocation) {
      if (geolocation) {
        return {
          longitude: geolocation.coords.longitude,
          latitude: geolocation.coords.latitude
        };
      }
      return {
        longitude: 0,
        latitude: 0
      };
    }

    /**
     *
     * @param {any} geolocation
     * @return {Array}
     */
    formatChartData(dataActionControl) {
      let values = dataActionControl.sentData.chartData.map((item) => {

        let YAxis = item.YAxis;
        let XAxis = item.XAxis;

        return {
          "series": XAxis,
          "group": "Dummy Group ID",
          "value": YAxis
        };
      });
      return values;
    }

    /**
     *
     * @param {Object} createIncidentRequest
     * @return {Object}
     */
    convertFileData(createIncidentRequest) {
      const convertedAttachments = createIncidentRequest.fileAttachments.map((file) => ({
        fileName: file.fileName,
        data: file.data.split(';base64,')[1]
      }));
      createIncidentRequest.fileAttachments = convertedAttachments;
      return createIncidentRequest;
    }
  }

  return FlowModule;
});