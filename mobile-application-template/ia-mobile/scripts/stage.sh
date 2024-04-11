#This file is to setup the prerequesties for the Mobile-VBCSAutomation.
#Use sh setup.sh or sh setup.sh <clientid> <Client Secret> <VisualBuilderURL> <gitpull> to execute the script

#!/bin/bash
unsetting due to failure in jenkins
unset http_proxy
unset https_proxy
# Set your OAuth client credentials
CLIENT_ID=$1
CLIENT_SECRET=$2
VISUAL_BUILDER_URL=$3
GIT_PULL=$4
# OAuth token endpoint
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
echo "$RESPONSE"
echo "Access Token: $ACCESS_TOKEN"

# API endpoint to make a POST request with the access token to pull from code base
PULL_URL="$VISUAL_BUILDER_URL/design/ia_qa_test/1.0/resources/git/pull"
# JSON data for the POST request
JSON_DATA='{}'
if [ "$GIT_PULL" == "gitpull" ]; then
# Send POST request with the access token in the Authorization header
PULL_RESPONSE=$(curl -X POST "$PULL_URL" \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d "$JSON_DATA" -w "\n%{http_code}")
	 
	 
echo "HTTP Response Code: $(echo "$PULL_RESPONSE" | tail -n 1)"

# Checking if the response code is 200
	if [ "$(echo "$PULL_RESPONSE" | tail -n 1)" -eq 200 ]; then
		echo "Pull request was successful."
	else
		echo "Pull request failed."
	fi
fi
# rebuild mobile application.

REBUILD_URL="$VISUAL_BUILDER_URL/design/ia_qa_test/1.0/resources/application/stage/new?vb-poll=true"
# JSON data for the POST request
JSON_DATA='{}'
# Send POST request with the access token in the Authorization header
REBUILD_RESPONSE=$(curl -X POST "$REBUILD_URL" \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d "$JSON_DATA" -w "\n%{http_code}")
	 
echo "HTTP Response Code: $(echo "$REBUILD_RESPONSE" | tail -n 1)"

# Checking if the response code is 202
if [ "$(echo "$REBUILD_RESPONSE" | tail -n 1)" -eq 202 ]; then
    echo "Rebuild was successful."
	echo "Staged app URL: $VISUAL_BUILDER_URL/rt/ia_qa_test/1.0/webApps/intelligentadvisorapp/"
else
    echo "Rebuild request failed."
fi	 
	 

	 