/**
 * Copyright © 2023, Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
define([
  "vbsw/helpers/serviceWorkerHelpers",
  /**
   * Add the following entries to include the toolkit classes that you'll use. More information about these
   * classes can be found in the toolkit's API doc. See the link to the API doc in the paragraph before
   * this sample file.
   *
   */
  "persist/persistenceManager",
  "persist/defaultResponseProxy",
  "persist/persistenceUtils",
  "persist/fetchStrategies",
  /**
   * Add the following entry to enable console logging while you develop your app with the toolkit.
   */
  "persist/impl/logger",
  "ojs/ojresponsiveutils",
  "ojs/ojresponsiveknockoututils"
], (
  ServiceWorkerHelpers,
  PersistenceManager,
  DefaultResponseProxy,
  PersistenceUtils,
  FetchStrategies,
  Logger,
  ResponsiveUtils,
  ResponsiveKnockoutUtils
) => {
  "use strict";

  class AppModule {
    constructor(context) {
      this.eventHelper = context.getEventHelper();
    }

    /**
     * Hide spinner screen since the application is ready to display root UI
     */
    hideSpinner() {
      // tear down the spinner screen
      const spinner = document.getElementById("vb-spinner");
      if (spinner) {
        // if the spinner screen is not yet displayed, immediately remove it and return
        const computedStyle = window.getComputedStyle(spinner);
        const opacity = parseInt(computedStyle.getPropertyValue("opacity"), 10);
        if (opacity < 0.1) {
          spinner.parentNode.removeChild(spinner);
          return;
        }

        const transEndFn = () => {
          if (spinner.parentNode) {
            spinner.parentNode.removeChild(spinner);
          }
          spinner.removeEventListener("transitionend", transEndFn);
        };

        spinner.addEventListener("transitionend", transEndFn, false);
        spinner.className += " vb-spinner-reveal-trans";
      }
    }

    /**
     *
     * @return {String}
     */
    getNetworkStatus() {
      return window.localStorage.getItem("networkStatus");
    }

    /**
     * Check if the application is online
     * 
     * @return {Boolean}
     */
    isAppOnline() {
      return this.getNetworkStatus() !== 'offline';
    }

    /**
      *
      * @param {String} type
      * @param {Object} response
      * @return {String}
      */
    checkRequestIsNeedToNavigate(type, response) {
      if (response.status === 401 || response.status === 403) {
        if (type === "getAllDeployments" || type === "startSession" || type === "login")
          return true;
      }
      return false;
    }

    /**
     *
     * @param {any} arg
     */
    logData(arg) {
      this.logDataWithScope('global', arg);
    }

    /**
     * @param {String} scope
     * @param {any} arg
     */
    logDataWithScope(scope, arg) {
      console.log(`[oj-ia-vb-app] [${scope}] `, arg);
    }

    /**
     * @param {String} scope
     * @param {any} arg
     */
    logWarning(scope, arg) {
      console.warn(`[oj-ia-vb-app] [${scope}]`, arg);
    }

    /**
     * @param {String} scope
     * @param {any} arg
     */
    logError(scope, arg) {
      console.error(`[oj-ia-vb-app] [${scope}]`, arg);
    }

    /**
     * Hold the current thread for a given amount of time. NOT recommended.
     * 
     * @param {Number} delaySeconds
     */
    delay(delaySeconds) {
      return new Promise((resolve, reject) => {
        setTimeout(resolve, delaySeconds * 1000);
      });
    }

    /**
     *
     * @return {String}
     */
    getAppId() {
      this.logData('Determining App ID with: ' + window.location.pathname);
      return "IA_MOBILE:" + window.location.pathname;
    }

    /**
     * Get the button display mode based on the screen size
     * 
     * @return {String}
     */
    getButtonDisplayMode() {
      let mdQuery = ResponsiveUtils.getFrameworkQuery('md-up');
      let medium = () => false;
      if (mdQuery != null) {
        medium = ResponsiveKnockoutUtils.createMediaQueryObservable(mdQuery);
      }
      return medium() ? 'all' : 'icons';
    }

    emptyFunction() {
    }

    /**
     * Generate a hash code for the input string.
     * 
     * @param {String} str
     * 
     */
    hashCode(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + code;
        // Convert to 32bit integer
        hash = hash & hash;
      }
      return hash;
    }

    /**
     * Convert original flow sent data object
     * 
     * @param {any} originalData
     * @return {any}
     */
    convertDataObject(originalData) {
      if (typeof originalData !== 'object' || originalData === null) {
        return originalData;
      }

      if (Array.isArray(originalData)) {
        let converted = [];
        for (let i = 0; i < originalData.length; i++) {
          converted[i] = this.convertDataObject(originalData[i]);
        }
        return converted;
      }

      let converted = {};
      Object.keys(originalData).forEach((key, index) => {
        if (key.startsWith('obj_') && Array.isArray(originalData[key])) {
          if (originalData[key].length > 0) {
            let requestKey = key.substring(4);
            converted[requestKey] = this.convertDataObject(originalData[key][0]);
          }
        } else {
          converted[key] = this.convertDataObject(originalData[key]);
        }
      });
      return converted;
    }

    //DEPLOYMENT MODULE

    /**
     * 
     * @param {String} appId
     */
    getLocalDeploymentDetailsKey(appId) {
      return appId + ":savedDeployments";
    }

    /**
     * 
     * @param {String} appId
     */
    async getLocalDeploymentDetails(appId) {
      return (await this.getLocalDeploymentDB().getItemAsync(this.getLocalDeploymentDetailsKey(appId))) ?? [];
    }

    /**
     * 
     * @param {String} appId
     * @param {Array} deploymentDetails
     */
    async saveDeploymentDetailsLocally(appId, deploymentDetails) {
      await this.getLocalDeploymentDB().setItemAsync(this.getLocalDeploymentDetailsKey(appId), deploymentDetails);
    }

    /**
     *
     * @param {String} appId
     * @param {Number} userId
     */
    getDataSyncStatusKey(appId, userId) {
      return appId + ":" + userId + ":isDataSyncWithServer";
    }

    /**
     *
     * @param {Number} userId
     * @param {String} appId
     * @param {boolean} status
     */
    setDataSyncStatus(appId, userId, status) {
      localStorage.setItem(this.getDataSyncStatusKey(appId, userId), status);
    }

    /**
     *
     * @param {String} appId
     * @param {Number} userId
     */
    getDataSyncStatus(appId, userId) {
      const dataSyncStatusKey = this.getDataSyncStatusKey(appId, userId);
      return localStorage.getItem(dataSyncStatusKey) ? JSON.parse(localStorage.getItem(dataSyncStatusKey)) : false;
    }

    // INDEXED DB INTERFACES

    getLocalDBConnectionName() {
      return 'ia_app_local';
    }

    getAssessmentObjectStoreName() {
      return 'assessments';
    }

    getDeploymentObjectStoreName() {
      return 'deployments';
    }

    getDataActionObjectStoreName() {
      return 'dataActions';
    }

    getAssessmentHistoryObjectStoreName() {
      return 'assessmentHist';
    }
    getPDFObjectStoreName() {
      return 'pdfReport';
    }

    async initLocalDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.getLocalDBConnectionName(), 2);
        request.onupgradeneeded = () => {
          try {
            // if upgrade needed, we need to add the new table.
            request.result.createObjectStore(this.getAssessmentHistoryObjectStoreName());

            // if request.result.version === 2, then database is being created as new
            // and we need to add all v1 tables also.
            if (request.result.version === 2) {
              request.result.createObjectStore(this.getAssessmentObjectStoreName());
              request.result.createObjectStore(this.getDeploymentObjectStoreName());
              request.result.createObjectStore(this.getDataActionObjectStoreName());
              request.result.createObjectStore(this.getPDFObjectStoreName());
            }
            // onsuccess will be called after onupgradeneeded completes, so no resolve() here
          } catch (error) {
            reject(error);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };

        request.onblocked = () => {
          reject(new Error('IndexedDB open request is blocked.'));
        };

        request.onsuccess = () => {
          resolve();
        };
      });
    }

    getLocalAssessmentDB() {
      return this.getLocalDB(this.getAssessmentObjectStoreName());
    }

    getLocalDeploymentDB() {
      return this.getLocalDB(this.getDeploymentObjectStoreName());
    }

    getLocalDataActionDB() {
      return this.getLocalDB(this.getDataActionObjectStoreName());
    }

    /**
     *
     * @param {String} objectStore
     */
    getLocalDB(objectStore) {
      return {
        getItemAsync: async (key) => this.getLocalValue(objectStore, key),
        setItemAsync: async (key, value) => this.setLocalValue(objectStore, key, value),
        removeItemAsync: async (key) => this.deleteLocalValue(objectStore, key)
      };
    }

    /**
     *
     * @param {String} dataObject
     * @param {String} key
     */
    async getLocalValue(dataObject, key) {
      return new Promise((resolve) => {
        let oRequest = indexedDB.open(this.getLocalDBConnectionName());
        oRequest.onsuccess = () => {
          let db = oRequest.result;
          let tx = db.transaction(dataObject, 'readonly');
          let st = tx.objectStore(dataObject);
          let gRequest = st.get(key);
          gRequest.onsuccess = () => {
            resolve(gRequest.result ?? null);
          };
          gRequest.onerror = () => {
            this.logError('global', gRequest.error);
            resolve(null);
          };
        };
        oRequest.onerror = () => {
          this.logError('global', oRequest.error);
          resolve(null);
        };
      });
    }

    /**
     *
     * @param {String} dataObject
     * @param {String} key
     * @param {Any} value
     */
    async setLocalValue(dataObject, key, value) {
      if (value === null || value === undefined) {
        return this.deleteLocalValue(dataObject, key);
      }
      return new Promise((resolve) => {
        let oRequest = indexedDB.open(this.getLocalDBConnectionName());
        oRequest.onsuccess = () => {
          let db = oRequest.result;
          let tx = db.transaction(dataObject, 'readwrite');
          let st = tx.objectStore(dataObject);
          // Deep copy the value to prevent errors on function
          let sRequest = st.put(JSON.parse(JSON.stringify(value)), key);
          sRequest.onsuccess = () => {
            resolve();
          };
          sRequest.onerror = () => {
            this.logError('global', sRequest.error);
            resolve();
          };
        };
        oRequest.onerror = () => {
          this.logError('global', oRequest.error);
          resolve();
        };
      });
    }

    /**
     *
     * @param {String} dataObject
     * @param {String} key
     */
    async deleteLocalValue(dataObject, key) {
      return new Promise((resolve) => {
        let oRequest = indexedDB.open(this.getLocalDBConnectionName());
        oRequest.onsuccess = () => {
          let db = oRequest.result;
          let tx = db.transaction(dataObject, 'readwrite');
          let st = tx.objectStore(dataObject);
          let rRequest = st.delete(key);
          rRequest.onsuccess = () => {
            resolve();
          };
          rRequest.onerror = () => {
            this.logError('global', rRequest.error);
            resolve();
          };
        };
        oRequest.onerror = () => {
          this.logError('global', oRequest.error);
          resolve();
        };
      });
    }

    async getAllIASessionHistoryRecords() {
      await this.initLocalDB();
      return new Promise((resolve) => {
        const records = [];
        let oRequest = indexedDB.open(this.getLocalDBConnectionName());
        oRequest.onerror = () => this.logError('global', oRequest.error);
        oRequest.onsuccess = () => {
          let db = oRequest.result;
          let tx = db.transaction(this.getAssessmentHistoryObjectStoreName(), 'readonly');

          let request = tx.objectStore(this.getAssessmentHistoryObjectStoreName()).openCursor();
          request.onerror = () => this.logError('global', request.error);
          request.onsuccess = () => {
            let cursor = request.result;
            if (cursor) {
              if ((cursor.value.tier3Count > 0) || (cursor.value.interactionCount > 0)) {
                records.push({
                  sessionJWT: cursor.primaryKey,
                  interactionCount: cursor.value.interactionCount,
                  tier3Count: cursor.value.tier3Count,
                });
              }
              cursor.continue();
            }
          }

          tx.onerror = () => this.logError('global', tx.error);
          tx.oncomplete = () => resolve(records);
        };
      });
    }

    async clearIASessionHistoryRecords(recordIds) {
      await this.initLocalDB();
      const localDb = this.getLocalDB(this.getAssessmentHistoryObjectStoreName());
      const promises = [];
      for (const id of recordIds) {
        promises.push(localDb.removeItemAsync(id));
      }
      await Promise.all(promises);
    }
  }

  // OFFLINE PERSISTENCE TOOLKIT

  function OfflineHandler() {
    /**
     * Enable console logging of the toolkit for development testing
     */
    Logger.option("level", Logger.LEVEL_LOG);
    Logger.option("writer", console);

    let options = {
      /**
       * The following code snippets implements the toolkit's CacheFirstStrategy. This strategy
       * checks the application's cache for the requested data before it makes a request to cache
       * data. The code snippet also disables the background fetch of data.
       */
      fetchStrategy: FetchStrategies.getCacheIfOfflineStrategy({
        backgroundFetch: "disabled",
      }),
    };

    this._responseProxy = DefaultResponseProxy.getResponseProxy(options);
  }

  OfflineHandler.prototype.handleRequest = function (request, scope) {
    /**
     * (Optional). Write output from the OfflineHandler to your browser's console. Useful to help
     * you understand  the code that follows.
     */
    console.log(
      "OfflineHandler.handleRequest() url = " +
      request.url +
      " cache = " +
      request.cache +
      " mode = " +
      request.mode
    );

    /**
     * Cache requests where the URL matches the scope for which you want data cached.
     */
    if (request.url.includes('/web-determinations/flow/staticresource/')) {
      console.log(`Using response proxy for request URL: ${request.url}`);
      return this._responseProxy.processRequest(request);
    }
    return PersistenceManager.browserFetch(request);
  };

  OfflineHandler.prototype.beforeSyncRequestListener = function (event) {
    return Promise.resolve();
  };

  OfflineHandler.prototype.afterSyncRequestListener = function (event) {
    return Promise.resolve();
  };

  AppModule.prototype.createOfflineHandler = function () {
    /** Create the OfflineHandler that makes the toolkit cache data URLs */
    return Promise.resolve(new OfflineHandler());
  };

  AppModule.prototype.isOnline = function () {
    return ServiceWorkerHelpers.isOnline();
  };

  AppModule.prototype.forceOffline = function (flag) {
    return ServiceWorkerHelpers.forceOffline(flag)
      .then(function () {
        /** if online, perform a data sync */
        if (!flag) {
          return ServiceWorkerHelpers.syncOfflineData();
        }
        return Promise.resolve();
      })
      .catch(function (error) {
        console.error(error);
      });
  };

  AppModule.prototype.dataSynch = function () {
    return ServiceWorkerHelpers.syncOfflineData();
  };

  return AppModule;
});
