#!/bin/bash

set -e

dir="$(cd -P -- "$(dirname -- "${BASH_SOURCE[0]:-$0}")" && pwd -P)"
cd "$dir/.."

echo ""
echo "Work directory: $PWD"
echo ""

PUBLISH="false"
CLEAN_DATA="true"

VBS_GIT_REPO_URL="https://dummy.com/dummy-repo.git"

for i in "$@"; do
  case $i in
    --vb-url=*)
      VB_URL="${i#*=}"
      VB_URL="${VB_URL%/}"
      shift # past argument=value
      ;;
    --vb-user=*)
      VB_USER="${i#*=}"
      shift # past argument=value
      ;;
    --vb-password=*)
      VB_PASSWORD="${i#*=}"
      shift # past argument=value
      ;;
    --vb-app-id=*)
      VB_APP_ID="${i#*=}"
      shift # past argument=value
      ;;
    --vb-app-version=*)
      VB_APP_VERSION="${i#*=}"
      shift # past argument=value
      ;;
    --exchange-url=*)
      EXCHANGE_URL="${i#*=}"
      EXCHANGE_URL="${EXCHANGE_URL%/}"
      shift # past argument=value
      ;;
    --exchange-user=*)
      EXCHANGE_USER="${i#*=}"
      shift # past argument=value
      ;;
    --exchange-password=*)
      EXCHANGE_PASSWORD="${i#*=}"
      shift # past argument=value
      ;;
    --vbs-git-repo-url=*)
      VBS_GIT_REPO_URL="${i#*=}"
      shift # past argument=value
      ;;
    --publish)
      PUBLISH="true"
      shift # past argument with no value
      ;;
    --keep-data)
      CLEAN_DATA="false"
      shift # past argument with no value
      ;;
    --help)
      echo ""
      echo "Please use the script in this format:"
      echo ""
      echo "source <script_path>/deploy.sh --vb-url=https://your_vb_host_url/ic/builder/ --vb-user=user@email.com --vb-password=your_password --vb-app-id=your_app_id --vb-app-version=desired_deploy_version --exchange-url=https://component_exchange_host_url/api/0.2.0/ --exchange-user=exchange.user@email.com --exchange-password=your_exchange_user_password [--vbs-git-repo-url='https://gitrepo.com/path/to/your_project.git'] [--publish] [--keep-data]"
      echo ""
      echo "--vbs-git-repo-url, --publish, and --keep-data parameters are optional."
      echo ""
      echo "--vbs-git-repo-url must be specified if the target VB app version is already linked with a Visual Builder Studio GIT repository."
      echo "--publish should be specified if you are going to publish the app runtime instead of staging it."
      echo "--keep-data should be specified if you would like to preserve the data in the previously staged or published app runtime."
      echo ""
      return 0
      ;;
    -*|--*)
      echo "Invalid option."
      echo ""
      echo "Please source the script with --help option to print the expected options to supply."
      echo ""
      return 1
      ;;
    *)
      ;;
  esac
done

echo "VB URL          = ${VB_URL}"
echo "VB USER         = ${VB_USER}"
echo "VB APP ID       = ${VB_APP_ID}"
echo "VB APP VERSION  = ${VB_APP_VERSION}"
echo "EXCHANGE URL    = ${EXCHANGE_URL}"
echo "EXCHANGE USER   = ${EXCHANGE_USER}"
echo "VBS GIT REPO    = ${VBS_GIT_REPO_URL}"
echo "PUBLISH THE APP = ${PUBLISH}"
echo "CLEAN UP DATA   = ${CLEAN_DATA}"

echo ''
echo 'Start the build process'
echo ''

source scripts/gruntScriptDeploy.sh "${VB_USER}" "${VB_PASSWORD}" "${VB_URL}" \
    "${VB_APP_ID}" "${VB_APP_VERSION}" false \
    "${EXCHANGE_URL}" "${EXCHANGE_USER}" "${EXCHANGE_PASSWORD}" \
    "${PUBLISH}" "${CLEAN_DATA}" "${VBS_GIT_REPO_URL}"

if [[ "${PUBLISH}" == "true" ]]; then
  echo "Deployed App URL: $VB_URL/rt/$VB_APP_ID/live/webApps/intelligentadvisorapp"
else
  echo "Deployed App URL: $VB_URL/rt/$VB_APP_ID/$VB_APP_VERSION/webApps/intelligentadvisorapp"
fi