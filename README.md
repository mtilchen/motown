
# _Motown_: Easy JavaScript Apps for Metro #

Motown is a library designed to help you build Metro-style apps based on web technologies that are maintainable and have great performance, using as
little code as possible. It makes smaller applications easy and larger more complex applications possible.

## Goals ##

+ Reduce glue code and boilerplate
+ Optimize performance, memory consumption and loading of pages/scripts/resources
+ Make application architecture implicit in the configuration
+ Promote maintainability, productivity, extensibility and reusability
+ Be user-friendly, intuitive and intelligent

## Features ##

+ Advanced stateful page navigation system with lifecycle hooks and WinJS.Navigation integration
+ Declarative "Refs" and "Actions" to easily hook your UI up to your application's logic and keep it loosely coupled
+ WinRT application lifecycle integration for handling launch/suspend/resume
+ Reduced application configuration in favor of familiar conventions
+ Debug logging facility that is disabled when your app is not running in the debugger
+ Exception logging (w/stacktraces) originating from Promises to help debug async code
+ Helper functions for creating dialogs, parameterized URIs and more
+ Visual Studio project template to get started quickly

## Getting Started ##

+ Download a tagged release (and unzip) or clone Motown from the public repository.
+ Copy the __“MotownAppTemplate”__ folder from the Motown root directory into: __%HOMEPATH%\\Documents\\Visual Studio 2012\\Templates\\ProjectTemplates\\JavaScript.__
+ Open Visual Studio (2012 RC and higher) and create a “New Project”.
+ In the “New Project” dialog select: “Templates -> JavaScript” and then “Motown App” from the list on the right.
+ Enter a name for your project and click “OK”.

On disk, your new project looks like:

    + Project Root
    |--+ views
    |      |-- home.html
    |--+ controllers
    |--+ models
    |--+ images
    |--+ css
    |     |--motown.css
    |     |--home.css
    |--+ js
    |    |-- motown.js
    |    |-- application.js
    |-- default.html

In Visual Studio open the "js/application.js" file to find all the code for the new application:

```javascript
  MT.configApp({
    name: 'New Project Name',
    namespace: 'My.NS',
    pages: [
     'home'
    ]
  });
```

Build, run and enjoy.

## Documentation ##

+ [API Documentation](http://mtilchen.github.com/motown)

## Download ##

[Download the latest stable release](http://labs.vectorform.com/wp-content/uploads/2012/07/mtilchen-motown-v0.1.1.zip)

## License ##

Motown is distributed under the LGPL v3 license. Please refer to the included 'LICENSE' file for more information.
