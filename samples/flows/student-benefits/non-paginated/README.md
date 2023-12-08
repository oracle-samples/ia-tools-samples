# Non-paginated flow rendering sample

## Redistribution
Developers choosing to distribute a binary implementation of any code in this repository are responsible for obtaining and
providing  all required licenses and copyright notices for the third-party code used in order to ensure compliance with their 
respective open source licenses.

## License
Copyright (c) 2023 Oracle and/or its affiliates and released under the 
[Universal Permissive License (UPL)](https://oss.oracle.com/licenses/upl/), Version 1.0

## Setting up

First, ensure that you have completed all steps from the "Setting up" section from the README for the parent "student-benefits" folder to install npm, import the Student Benefits flow scheme and flow project to your Intelligent Advisor hub, and create an API client.

Then, from the VSCode terminal (Ctrl+`), or a command window in the root of the project execute:  

    npm install  

## Webpack arguments

When either webpack or webpack-dev-server are executed the default configuration is to
build the project in development mode. In development mode sourcemaps are output, and
the entry point is debug/debug.tsx, where the initial content that is rendered consists
of various forms to assist with easily obtaining a Hub bearer token and JWT for the
Flow project version you want to debug.

With the --mode=production argument the entry point is src/index.tsx which expects a
JWT and any global input values to be supplied in URL parameters: there is no
assistance for Hub or Web Determinations operations.

### To debug the project with webpack-dev-server:

    npx webpack-dev-server

> Note: The debug configuration hosts the project at http://localhost:8081, and will
> render a page for easily obtaining a Hub bearer token and JWT for the specified
> Flow project version, and specifying global input values. With the VSCode launch
> profile you can attach Edge to step through breakpoints.


### To build the sample to launch with the easy-launch page and debug data action adapter for running locally (without VSCode):

    npx webpack


### To build the sample to launch only with an already obtained JWT, for running locally:

    npx webpack --mode=production


## URL parameters

The URL for immediately rendering a flow in either debug or production modes may look
something like:

> [https://{host}?_iajwt={JWT value}&_globalDataBase64={Base64 of JSON for global input}]()

### _iajwt

the JWT for the Flow is required to start a Flow. In a production build there
is no assistance for obtaining this, it must be provided. In the debug build if this
parameter is not supplied various forms will be rendered on the screen asking for Hub
credentials, the Flow name and version, and the 'Start [flow name]' button will open
a new tab with the JWT value in the _iajwt parameter as would be expected for the production
build of this project.

For further information see [Get a session token](https://documentation.custhelp.com/euf/assets/devdocs/unversioned/IntelligentAdvisor/en/Content/Guides/Customize_extend/Flow_Engine_API/Get_a_session_token.htm)

### _globalDataBase64

This is an optional parameter, if provided the value should be a Base64 encoding of a JSON
containing global input values for the Flow. As with the _iajwt parameter there is help
for building this in the debug build, but not in production.

For further information see [Global input data](https://documentation.custhelp.com/euf/assets/devdocs/unversioned/IntelligentAdvisor/en/Content/Guides/Customize_extend/Flow_Engine_API/Global_input_data.htm)

### _debugger
This is an optional parameter that controls whether the debugger should be displayed. If the value is true the
flow debugger will be displayed. 

**Note:** to display the debugger, the provided [session token](#iajwt) must have an action of *debug*. 