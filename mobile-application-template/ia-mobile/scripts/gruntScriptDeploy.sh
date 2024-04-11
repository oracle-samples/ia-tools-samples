#!/bin/bash

CLIENT_ID=$1
CLIENT_SECRET=$2
VISUAL_BUILDER_URL=$3
VB_APP_ID=$4
VB_APP_VERSION=$5
DELETE_APP=$6
COMPONENT_EXCHANGE_URL=$7
COMPONENT_EXCHANGE_USER=$8
COMPONENT_EXCHANGE_PASSWORD=$9
PUBLISH_FLAG=${10}
CLEAN_DATA_FLAG=${11}
VBS_GIT_REPO_URL="${12:-https://dummy.com/dummy-repo.git}"

VB_APP="${VB_APP_ID}-${VB_APP_VERSION}"
echo "VB App: ${VB_APP}"
echo "VBS GIT Repository: ${VBS_GIT_REPO_URL}"

if [[ "$CLEAN_DATA_FLAG" == "false" ]]; then
  if [[ "$PUBLISH_FLAG" == "true" ]]; then
    DATA_SCHEMA="live"
  else
    DATA_SCHEMA="stage"
  fi
else
  DATA_SCHEMA="new"
fi
echo "VB Data Schema: ${DATA_SCHEMA}"

echo "npm version"
npm -version
npm install

TOKEN_URL="$VISUAL_BUILDER_URL/basicauth"
echo "$TOKEN_URL"
# Defining the grant type
GRANT_TYPE="client_credentials"
# Send POST request to get the access token from visual builder
RESPONSE=$(curl -s -X POST "$TOKEN_URL" \
	 -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=$GRANT_TYPE" \
     -u "$CLIENT_ID:$CLIENT_SECRET")
ACCESS_TOKEN=$(echo "$RESPONSE" | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')

echo "Access Token: ${ACCESS_TOKEN:0:10} ......"

if [[ "$DELETE_APP" == "true" ]]; then
  DELETE_RESPONSE=$(curl -s -X DELETE "$VISUAL_BUILDER_URL/resources/application/$VB_APP"  -H "Authorization: Bearer $ACCESS_TOKEN")
  echo "$DELETE_RESPONSE"
else
  echo "Delete application was not selected."
fi


# cleans the folder by removing unwanted files prior to the packaging
./node_modules/.bin/grunt vb-clean

./node_modules/.bin/grunt vb-process-local --url:ce=$COMPONENT_EXCHANGE_URL --username:ce=$COMPONENT_EXCHANGE_USER --password:ce=$COMPONENT_EXCHANGE_PASSWORD

./node_modules/.bin/grunt vb-package --force

# user either one of the below vb-deploy step

./node_modules/.bin/grunt vb-deploy --url:rt=$VISUAL_BUILDER_URL --accessToken:rt=$ACCESS_TOKEN --id=$VB_APP_ID --remoteProjectId=$VB_APP_ID --ver=$VB_APP_VERSION --publish=$PUBLISH_FLAG --schema=$DATA_SCHEMA --remoteGitRepo="${VBS_GIT_REPO_URL}"
#./node_modules/.bin/grunt vb-deploy --url:rt=$VISUAL_BUILDER_URL --username:rt=$CLIENT_ID --password:rt=$CLIENT_SECRET --id=$VB_APP_ID --remoteProjectId=$VB_APP_ID --ver=$VB_APP_VERSION --publish=$PUBLISH_FLAG --schema=$DATA_SCHEMA --remoteGitRepo="${VBS_GIT_REPO_URL}"
