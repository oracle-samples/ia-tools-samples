## 3.0.0

- IA VDOM component supports pdf generation from a page.Now you can enable pdf export from a page by setting true on "PDF Export" property.
- Support for billing, for compliance purposes the following information is recorded...
    - When a new assessment is created or an existing assessment is re-visited (opened). This will be referred to as an Interaction
    - Activity within an assessment is recorded.
    - The only data recorded with Interaction or Activity is a count (number) of the number of times it occurred for each assessment.
- Support for Flow debugging 

## 2.0.0

- Rebase on VB web application template which comes with better Redwood stylings.
- Update *oj-ia* JET pack dependency to version 2.2.0.
- Move external API authentication configurations from *Service Connections* to *Service Backends*.
- Add samples that leverage the *controlSlot* property of *oj-ia-intv* component to define custom rendering for IA controls.
- Add samples that overwrite the CSS of the *oj-ia-intv* component's built-in control rendering.
- Use IndexedDB for offline data storage.
- Refactor the assessment synchronization process for better assessment metadata management.
- Refactor the deployment caching process for simpler offline deployment management.
- Use horizontal navigation train as the default navigation rendering on a large screen for any assessment.
- Support forced offline mode to only use explicitly cached flow.
- Provide more flexible B2C Service account matching mechanism.
- Improve the data submit sample with file attachments added.
- Utilize the app translation bundle for static strings.
- Provide a helper script to bundle and deploy the application from command line for full offline support at runtime.
- Include other minor enhancement and bug fixes.

## 1.0.0

- Initial major version of Intelligent Advisor Visual Builder mobile application template. Please check the README file for more details.