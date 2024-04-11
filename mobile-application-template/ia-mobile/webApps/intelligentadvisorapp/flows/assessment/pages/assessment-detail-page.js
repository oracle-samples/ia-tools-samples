/**
 * Copyright © 2023, Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
define(['ojs/ojfilepickerutils', 'ojs/ojhtmlutils'], (FilePickerUtils, HtmlUtils) => {
  'use strict';

  class PageModule {

    constructor(context) {
      this.eventHelper = context.getEventHelper();
    }

    getChroming(status, button) {
      if (status === null) {
        return null;
      }
      else if (status && button === 'yes') {
        return "callToAction";
      }
      else if (!status && button === 'yes') {
        return null;
      }
      else if (status && button === 'no') {
        return null;
      }
      else if (!status && button === 'no') {
        return "danger";
      }
    }

    getHtmlConfig(control) {
      return {
        view: HtmlUtils.stringToNodeArray(control.html)
      };
    }

    /**
     * Handle the file upload process for a given IA flow control item.
     * 
     * @param {Object} control
     */
    onFilePicker(control) {
      FilePickerUtils.pickFiles((files) => {
        const filePromises = [];

        for (const file of files) {
          if (file) {
            filePromises.push(
              new Promise((resolve) => {
                const reader = new FileReader();
                reader.addEventListener(
                  'load',
                  function () {
                    resolve({
                      name: file.name,
                      content: reader.result
                    });
                  },
                  false
                );

                // read the file
                reader.readAsDataURL(file);
              })
            );
          }
        }

        Promise.all(filePromises).then((fileList) => {
          const payload = {
            files: fileList
          };

          this.eventHelper.fireCustomEvent("onFileSelected", { dataActionId: control.id, returnData: payload });
        });
      }, {
        accept: [],
        capture: "none",
        selectionMode: "multiple",
      });
    }

  }

  return PageModule;
});
