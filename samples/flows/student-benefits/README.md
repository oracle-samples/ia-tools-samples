# Intelligent Advisor flow rendering samples for Student Benefits
The Intelligent Advisor Flow Engine API allows complete control over rendering an interactive Intelligent Advisor experience. Flows authored in Intelligent Advisor Hub are similar to Policy Modeling interviews, but with greater flexibility when it comes to rendering controls and how data enters the session. Like other Intelligent Advisor products, rules in a flow project drive form behavior and decisions based on input values, with input data coming both from the user and from external sources. The flow author places input controls and data actions in order within pages and other grouping controls. Once deployed the user interacts with the rendered flow.

Each flow is built upon a flow scheme, and it is the flow scheme which defines the names of controls as they appear to both flow authors within the Hub, and to any JavaScript/TypeScript application that interacts with the Flow Engine API to render the flow. The application responsible for rendering the controls accesses the controls via their integration IDs, while in the flow authoring experience within the Hub the controls are named according to their Name in palette.

Two rendering samples are provided:

* The [paginated sample](paginated) which renders the flow as a series of pages
* The [non-paginated sample](non-paginated) which rendered the flow in a single scrollable view

 Both of these samples render a provided flow project called *Student Benefits* that is built upon a flow scheme called *Scheme for Student Benefits*. The Student Benefits project is similar to the Policy Modeling example StudentBenefits and some familiarity with that example would be helpful to understand the differences in how Policy Modeling interviews and flows are authored and implemented. Compared to the default web interview flow scheme, Scheme for Student Benefits defines a few additional controls and custom data actions, and defines some global input data. The TypeScript project included in this sample interacts with the Flow Engine API which exposes the **kind** and **integration id** of each of the controls as defined in the flow scheme, and uses Preact to render them.

## Setting up
To set up these samples:

1. Ensure you have [Node.js](https://nodejs.org/) 16.18.0 or later installed on your machine, with these optional features:
    1. npm package manager - this is needed to retrieve dependencies when setting up the sample
    1. Add to PATH - this will enable you to use the command line instructions as they appear in README files for the [paginated](paginated/README.md) and [non-paginated](non-paginated/README.md) samples
1. In Intelligent Advisor Hub, use the Action menu on the Projects page to
    1. Import the scheme project file Scheme for Student Benefits.json
    1. Import the flow project file Student Benefits.json
For more information, see [Import an existing project](https://documentation.custhelp.com/euf/assets/devdocs/unversioned/IntelligentAdvisor/en/Content/Guides/Use_Intelligent_Advisor/Manage_projects/Import_existing_project.htm).
1. In Intelligent Advisor Hub, use the Permissions view to
    1. Create an API Client user with the Interview APIs role. Remember the client id and client secret you choose
    1. Use the Actions/Access Settings menu to give http://localhost:8081 access to both Interviews and Hub

## Running the samples
See the README files for the [paginated](paginated/README.md) and [non-paginated](non-paginated/README.md) samples for the remaning steps to get each sample running.

The following sections provide more details on how the flow scheme and flow project.

## Flow scheme
The Scheme for Students Benefits flow scheme is based on the default Web interview scheme template in Intelligent Advisor Hub but with four additional controls added:
* A label control called "Heading"
* A label control called "HTML Block"
* A custom data action control called "Load existing student details"
* A custom data action called "Save student benefit request"

Also, the original "Label" control was renamed "Paragraph" (but the integration id was left as "label").

Global input data was also defined:
* existing-student-id
* defined-citizenship-statuses
* defined-enrollment-statuses
* defined-genders

For more information, see:
* [Create a new project](https://documentation.custhelp.com/euf/assets/devdocs/unversioned/IntelligentAdvisor/en/Content/Guides/Use_Intelligent_Advisor/Manage_projects/Create_a_new_project.htm)
* [Add or edit a control in a flow scheme](https://documentation.custhelp.com/euf/assets/devdocs/unversioned/IntelligentAdvisor/en/Content/Guides/Use_Intelligent_Advisor/Author_flow_schemes/Add_edit_control_flow_scheme.htm)
* [Add or edit a custom data action in a flow scheme](https://documentation.custhelp.com/euf/assets/devdocs/unversioned/IntelligentAdvisor/en/Content/Guides/Use_Intelligent_Advisor/Author_flow_schemes/Add_edit_custom_data_action_flow_scheme.htm)
* [Add or edit input data in a flow scheme](https://documentation.custhelp.com/euf/assets/devdocs/unversioned/IntelligentAdvisor/en/Content/Guides/Use_Intelligent_Advisor/Author_flow_schemes/Add_edit_input_data_flow_scheme.htm)

### Global input data
The global input data allows the rendering project to supply values for each of the properties after the session has been created.
The existing-student-id is a Number field and if a value is supplied in the global input data, then when the first page is rendered the *Load existing student details* custom data action will use the existing-student-id value in order to receive some details about the student.
There are also three Arrays (defined-citizenship-statuses, defined-enrollment-statuses and defined-genders) in the global input data. Aside from the *name* field, the other data returned by the *Load existing student details* custom data action must reference one of the named records of each of these arrays. That is, the *defined-genders* array defines two named records *male* and *female* and when a student’s details are loaded, the gender field of the *Load existing student details* custom data action must use one of those named record values.

### Heading label
The Heading label control was added so that text could be styled as a heading. (Similarly to the styling of the heading text on the "Congratulations you are Eligible for Student Aid" screen and "Not Eligible for Student Aid" screen in the original Student Benefits interview.) This control is rendered by the sample rendering project by getting the author-defined number value of the 'header-level' custom property (a value from 1 to 6) which represents an HTML header element from \<h1\> to 
\<h6\>. 

### HTML Block label
The HTML Block label control was added to allow hyperlinks in paragraph text. This control is rendered by the sample rendering project by treating all text as raw HTML, and using the [dangerouslySetInnerHTML function](https://legacy.reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml) to set HTML wherever these controls should be rendered. The sample strips out any tags that are not on the allowed list.

### Load existing student details custom data action
This custom data action loads data for an existing student, such as the student's name, at the start of the interview.

The send data for this custom data action is defined as follows:
| TYPE | INTEGRATION PROPERTY | DISPLAY NAME | DEFAULT FIELD NAME IN FLOW |
|------|----------------------|--------------|----------------------------|
| Number| id | The existing student's ID | the existing student's ID |

The return data for this custom data action is defined as follows: 
| TYPE             | INTEGRATION PROPERTY | REFERENCED OBJECT                        | DISPLAY NAME                                          | DEFAULT FIELD NAME IN FLOW                            |
|------------------|----------------------|------------------------------------------|-------------------------------------------------------|-------------------------------------------------------|
| String           | name                 | N/A                                      | The existing student's name                           | the existing student's name                           |
| Record reference | citizenship-status   | Defined citizenship/immigration statuses | The existing student's citizenship/immigration status | the existing student's citizenship/immigration status |
| Record reference | enrollment-status    | Defined enrollment statuses              | The existing student's enrollment status              | the existing student's enrollment status              |
| Record reference | gender               | Defined genders                          | The existing student's gender                         | the existing student's gender                         |

### Save student benefit request custom data action
This custom data action saves data at the end of the interview, and returns a reference number for the 'Incident' related to the submitted data.

The Send fields for this custom data action are defined as follows:
|     TYPE                 |     INTEGRATION   PROPERTY     |     REFERENCED   OBJECT                            |     DISPLAY NAME                                       |     DEFAULT FIELD   NAME IN FLOW                       |
|--------------------------|--------------------------------|----------------------------------------------------|--------------------------------------------------------|--------------------------------------------------------|
|     Number               |     existing-student-id        |     N/A                                            |     The existing   student's ID                        |     the existing   student's ID                        |
|     String               |     student-name               |     N/A                                            |     The student's name                                 |     the student's name                                 |
|     Record reference     |     citizenship-status         |     Defined   citizenship/immigration statuses     |     The student's   citizenship/immigration status     |     the student's   citizenship/immigration status     |
|     Record reference     |     enrollment-status          |     Defined enrollment   statuses                  |     The student's enrollment   status                  |     the student's   enrollment status                  |
|     Record reference     |     gender                     |     Defined genders                                |     The student's   gender                             |     the student's   gender                             |


The Return fields for this custom data action are defined as follows: TYPE INTEGRATION PROPERTY
|     TYPE       |     INTEGRATION   PROPERTY         |     DISPLAY NAME                                 |     DEFAULT FIELD   NAME IN FLOW                 |
|----------------|------------------------------------|--------------------------------------------------|--------------------------------------------------|
|     String     |     request-reference-number       |     The benefit   request's reference number     |     the benefit   request's reference number     |
|     String     |     failure-message                |     The benefit   request's failure message      |     the benefit   request's failure message      |

## Flow project
When you create a flow project, you select a scheme upon which the controls, data actions and other settings are defined in. The Students Benefits flow project uses the Scheme for Students Benefits flow scheme.
For more information, see [Create a new project](https://documentation.custhelp.com/euf/assets/devdocs/unversioned/IntelligentAdvisor/en/Content/Guides/Use_Intelligent_Advisor/Manage_projects/Create_a_new_project.htm).

### Flow
The flow project, as defined on the Flow tab, has the following page groups (these are equivalent to stages in a Policy Modeling interview): Eligibility, Student Details, Immigration Status, Education, Declarations and Conclusion.
These page groups contain the following pages (these are equivalent to screens in a Policy Modeling interview):
* Eligibility: Eligibility for Student Aid
* Student Details: Basic Information, SSN Exceptions, Family
* Immigration status: I-94 Status, Designation, Issuance Date of Arrival-Departure Record (I-94), Parolees
* Education: Satisfactory Academic Progress, Previous Education
* Declarations: Declarations
* Conclusion: Congratulations you are Eligible for Student Aid, Details Saved, Not Eligible for Student Aid

For more information, see [Add a page to a flow](https://documentation.custhelp.com/euf/assets/devdocs/unversioned/IntelligentAdvisor/en/Content/Guides/Use_Intelligent_Advisor/Author_flows/Add_a_page_to_flow.htm).

Various standard input controls, such as Text, Number, Currency, Date, Radio group, Radio yes/no, Dropdown list, are used on these pages. Note that when adding inputs to pages, a control of a particular type must be placed on the page and then the "Set value for" property of the control defines the name of the field.

There is also label text (Paragraph). Some label text contains text substitution.

For more information, see [Add an input to a flow](https://documentation.custhelp.com/euf/assets/devdocs/unversioned/IntelligentAdvisor/en/Content/Guides/Use_Intelligent_Advisor/Author_flows/Add_an_input_to_flow.htm).

Comments are used to explain the implementation in the flow (these are not displayed in the runtime).

The Main section, which is the container around the flow, includes the properties for configuring the flow. Here you can see the various scheme input properties. The names of these properties are unchanged from what was defined in the scheme.

Of note:
* The Eligibility for Student Aid page contains the Load existing student details custom data action control.
* The Details Saved page contains the Save student benefit request custom data action control.
* The Congratulations you are Eligible for Student Aid and Not Eligible for Student Aid pages have Heading labels. The properties panel shows the header-level for these headings.
* The Congratulations you are Eligible for Student Aid and Not Eligible for Student Aid pages also have HTML Block labels that contain hyperlinks.

### Relevancy and page visibility
The Goals property of the Main section is where the fields that drive relevance are defined. In this flow project "the student satisfies the basic eligibility requirements for student aid" is the only goal used to determine relevance for a user completing the flow. Almost all rules in this project affect the outcome of this goal, therefore, setting this as the goal will help the flow engine decide which pages are relevant.
A page is considered relevant if any of the input controls on it collect values for rules which may influence the outcome of any of the listed Main section goals.
Therefore, to ensure only relevant pages are shown in the flow, for each page which has input controls that influence the goal defined for the flow, the **Visible** property is set to **if relevant**.

The first page Eligibility for Student Aid needs to always be shown, as it is both an introduction and contains the custom data action to load an existing student, so Visible is set to always.
As previously mentioned, the major conclusion of the flow is whether the student is eligible for student aid or not. The visibility of the two pages explaining these conclusions use visibility properties to control their display. That is:
* Congratulations you are Eligible for Student Aid has Visible set to only if "the student satisfies the basic eligibility requirements for student aid"
* Not Eligible for Student Aid has Visible set to unless "the student satisfies the basic eligibility requirements for student aid"
A page following the Congratulations you are Eligible for Student Aid page, Details Saved, also uses the same **only if** condition and uses visibility conditions on each Paragraph control depending on whether the save action was successful.

### Rules
The rules for the flow are shown on the Rules tab. These are equivalent to the substantive rules in the original Student Benefits policy model. Note that the visibility rules and procedural rules from the original project did not need to be included in the flow project as these features are handled differently in flows.