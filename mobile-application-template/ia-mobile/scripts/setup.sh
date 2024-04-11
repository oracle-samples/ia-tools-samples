#!/bin/bash
# This script will initially clear the files/folders of the previous run, then run grunt script in the workspace which is pulled from the ojet-intelligent-advisor-mobile-replacement.git. Using python selenium we will add the missing credentials in the vb application and will export the vb application. After exporting we will unzip and again run grunt scripts and redeploy the exported vb application with credentials.
CLIENT_ID=$1
CLIENT_SECRET=$2
VISUAL_BUILDER_URL=$3
COMPONENT_EXCHANGE_URL=$4
VB_APP_ID=$5
VB_APP_VERSION=$6
ZIP_FILE="$VB_APP_ID-$VB_APP_VERSION.zip"
ZIP_FOLDER="${VB_APP_ID}-${VB_APP_VERSION}"

# credentials are fetched from the credentials.csv file if we run this locally.(Uncomment this and use if we are running the script without jenkins)
#credentials_file="./scripts/credentials.csv"
#COMPONENT_EXCHANGE_USER=$(echo $(grep "^Component exchange," "$credentials_file") | cut -d ',' -f 2)
#COMPONENT_EXCHANGE_PASSWORD=$(echo $(grep "^Component exchange," "$credentials_file") | cut -d ',' -f 3)
#HUB_USER=$(echo $(grep "^Hub," "$credentials_file") | cut -d ',' -f 2)
#HUB_PASSWORD=$(echo $(grep "^Hub," "$credentials_file") | cut -d ',' -f 3)
#B2C_USER=$(echo $(grep "^B2C," "$credentials_file") | cut -d ',' -f 2)
#B2C_PASSWORD=$(echo $(grep "^B2C," "$credentials_file") | cut -d ',' -f 3)

# this is the folder where we extract the exported vb application
EXTRACTION_DIR="C:\Users\buildmaster\Downloads\\${ZIP_FOLDER}"
DOWNLOADS_DIR="C:\Users\buildmaster\Downloads"
# Check if the file exists in the Downloads directory
if [ -e "$DOWNLOADS_DIR/$ZIP_FILE" ]; then
    # File exists, so delete it
    rm "$DOWNLOADS_DIR/$ZIP_FILE"
    echo "File '$ZIP_FILE' deleted successfully."
else
    # File doesn't exist
    echo "File '$ZIP_FILE' not found in Downloads directory."
fi

if [ -d "$DOWNLOADS_DIR/$ZIP_FOLDER" ]; then
    # Folder exists, so delete it
	rm -r "$DOWNLOADS_DIR/$ZIP_FOLDER"
	echo "Folder '$ZIP_FOLDER' deleted successfully."
else
    # Folder doesn't exist
    echo "Folder '$ZIP_FOLDER' not found in Downloads directory."
fi

# Path to the Chrome WebDriver executable (update this with chromedriver path)
CHROME_DRIVER_PATH="C:\Windows\System32\chromedriver.exe"

export NOPROXY=.us.oracle.com,localhost,.oraclecorp.com,.oc-test.com,*.oraclevcn.com
export NO_PROXY=.us.oracle.com,localhost,.oraclecorp.com,.oc-test.com,*.oraclevcn.com
export https_proxy=http://www-proxy.us.oracle.com:80
export http_proxy=http://www-proxy.us.oracle.com:80

pwd

source ./scripts/gruntScriptDeploy.sh $CLIENT_ID $CLIENT_SECRET $VISUAL_BUILDER_URL $VB_APP_ID $VB_APP_VERSION true $COMPONENT_EXCHANGE_URL $COMPONENT_EXCHANGE_USER $COMPONENT_EXCHANGE_PASSWORD
	 
# run pip install selenium if we are running this script in the VM for first time to install selenium (python has to be installed)
# pip install selenium
# The following script is used to add credentials to the visual builder application after the initial vb-deploy
python <<END
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
# Configure Chrome WebDriver
chrome_service = Service("${CHROME_DRIVER_PATH}")
chrome_options = webdriver.ChromeOptions()
# Remove the --headless option to run with a visible browser
# chrome_options.add_argument('--headless')
# Initialize the WebDriver
driver = webdriver.Chrome(service=chrome_service, options=chrome_options)
# Open the login page
try:
  driver.get("${VISUAL_BUILDER_URL}")
  driver.maximize_window()
  # Handle cookie consent (modify this part based on the website's implementation)
  try:
      cookie_accept_button = WebDriverWait(driver, 10).until(
          EC.presence_of_element_located((By.XPATH, "//a[text()='Accept all']"))
      )
      cookie_accept_button.click()
  except Exception as e:
      print("Cookie consent not found or couldn't be clicked:", e)
  username_field = driver.find_element(By.ID, "idcs-signin-basic-signin-form-username")
  password_field = driver.find_element(By.ID, "idcs-signin-basic-signin-form-password")
  submit_button = driver.find_element(By.ID, "idcs-signin-basic-signin-form-submit")
  username_field.send_keys("${CLIENT_ID}")
  password_field.send_keys("${CLIENT_SECRET}")
  submit_button.click()
  time.sleep(30)

  vb_app_name = WebDriverWait(driver,30).until(
  EC.presence_of_element_located((By.XPATH, "//span[text()= '${VB_APP_ID}']"))
  )
  vb_app_name.click()
  time.sleep(20)

  vb_servcies = WebDriverWait(driver,20).until(
  EC.presence_of_element_located((By.XPATH, "//span[@aria-label='Services']"))
  )
  vb_servcies.click()

  vb_backend = WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.XPATH, "//span[text()='Backends']"))
  )
  vb_backend.click()
  time.sleep(5)

  vb_hub_backend = WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.XPATH, "//span[@data-vb-id='Oracle Intelligent Advisor Hub Backend']"))
  )
  vb_hub_backend.click()
  time.sleep(5)

  vb_backend_server= WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.XPATH, "//span[text()='Servers']"))
  )
  vb_backend_server.click()
  time.sleep(5)

  vb_backend_server_edit= WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.XPATH, "//span[@class='oj-ux-ico-edit']"))
  )
  vb_backend_server_edit.click()
  time.sleep(10)

  vb_backend_server_clientid_edit= WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.XPATH, "(//span[@class='oj-ux-ico-edit'])[3]"))
  )
  vb_backend_server_clientid_edit.click()
  time.sleep(10)
  clientid_field = driver.find_element(By.XPATH, "//span[text()='Client ID']/ancestor::div[contains(@id,'loggedin-user--encyrptfield')]//input")
  secret_field = driver.find_element(By.XPATH, "//span[text()='Secret']/ancestor::div[contains(@id,'loggedin-user--encyrptfield')]//input")
  clientid_field.clear()
  secret_field.clear()
  clientid_field.send_keys("${HUB_USER}")
  secret_field.send_keys("${HUB_PASSWORD}")
  time.sleep(10)
  vb_credentials_save= WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.XPATH, "//h1[text()='User Credentials']/ancestor::div[@id='loggedin-user--ws-security_layer']//span[text()='Save']"))
  )
  vb_credentials_save.click()
  time.sleep(10)
  vb_editservers_save= WebDriverWait(driver,20).until(
  EC.presence_of_element_located((By.XPATH, "//span[text()='Edit Server']/ancestor::div[@id='TransactionDialog_layer']//span[contains(@id,'TransactionDialog')]//span[text()='Save']"))
  )
  vb_editservers_save.click()
  time.sleep(10)

  vb_b2c_backend = WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.XPATH, "//span[@data-vb-id='Oracle B2C Service Backend']"))
  )
  vb_b2c_backend.click()
  time.sleep(10)

  vb_backend_server= WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.XPATH, "//span[text()='Servers']"))
  )
  vb_backend_server.click()
  time.sleep(5)

  vb_backend_server_edit= WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.XPATH, "//span[@class='oj-ux-ico-edit']"))
  )
  vb_backend_server_edit.click()

  time.sleep(5)
  vb_backend_server_clientid_edit= WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.XPATH, "(//span[@class='oj-ux-ico-edit'])[2]"))
  )
  vb_backend_server_clientid_edit.click()
  time.sleep(10)
  b2c_username_field = driver.find_element(By.XPATH, "//span[text()='Username']/ancestor::div[contains(@id,'loggedin-user--encyrptfield')]//input")
  b2c_password_field = driver.find_element(By.XPATH, "//span[text()='Password']/ancestor::div[contains(@id,'loggedin-user--encyrptfield')]//input")
  b2c_username_field.clear()
  b2c_password_field.clear()
  b2c_username_field.send_keys("${B2C_USER}")
  b2c_password_field.send_keys("${B2C_PASSWORD}")
  time.sleep(5)
  driver.find_element(By.XPATH, "//span[contains(@id,'credential-okButton') and text()='Save']").click()
  time.sleep(5)
  driver.find_element(By.XPATH, "//span[contains(@id,'TransactionDialog-commit')]/span[text()='Save']").click()
  time.sleep(10)
  vb_header_menu= WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.ID, "header-menu-2"))
  )
  vb_header_menu.click()
  time.sleep(10)

  vb_export_menu= WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.XPATH, "//a[text()='Export']"))
  )
  vb_export_menu.click()

  vb_exportwithdata_menu= WebDriverWait(driver,10).until(
  EC.presence_of_element_located((By.XPATH, "//div[@class='wizard-tile-title' and text()='Export with Data']"))
  )
  vb_exportwithdata_menu.click()
  time.sleep(40)
  print("Updated Credentials successfully.")
except Exception as e:
    print("The following exception occurred while setting up credentials in Visual builder ", e)
finally:
  # Close the browser
  driver.quit()
END

# Check if the ZIP file exists
if [ -f "$DOWNLOADS_DIR/${ZIP_FILE}" ]; then
    mkdir -p "$EXTRACTION_DIR"
    unzip -q "$DOWNLOADS_DIR/$ZIP_FILE" -d "$EXTRACTION_DIR" &
    wait
    echo "File '$ZIP_FILE' extracted to '$EXTRACTION_DIR'."
else
    echo "ZIP file '$ZIP_FILE' not found. Please review the credential setup."
    exit 1
fi


cd "$DOWNLOADS_DIR/$ZIP_FOLDER"
 
pwd

source ./scripts/gruntScriptDeploy.sh $CLIENT_ID $CLIENT_SECRET $VISUAL_BUILDER_URL $VB_APP_ID $VB_APP_VERSION false $COMPONENT_EXCHANGE_URL $COMPONENT_EXCHANGE_USER $COMPONENT_EXCHANGE_PASSWORD

echo "Staged app URL: $VISUAL_BUILDER_URL/rt/$VB_APP_ID/$VB_APP_VERSION/webApps/intelligentadvisorapp"