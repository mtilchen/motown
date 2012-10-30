
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
+ Open Visual Studio 2012 and create a “New Project”.
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

Build and run. Now keep the following in mind as you build your app to reduce boilerplate and glue code.

### Add "refs" to your views, use them in your controllers ###

In your view, use the "data-motown-ref" attribute to reference any control/element:

```html
  <div id="somemarkup">
    <button data-win-motown-ref="submitButton">Submit</button>
  </div>
```

Use the reference in your controller with the "refs" property.

```javascript
   // in a controller method
  this.refs.submitButton.style.display = 'none';
```

### Add "actions" to controls in your view, handle the events in your controllers ###

Use the "data-motown-action" attribute to declaratively bind control events to controller methods.

```html
  <div id="somemarkup">
    <button data-win-motown-actions="{ click: 'onBack' }">Back</button>
  </div>
```

Your controller method named 'onBack' will be called when the button's 'click' event is fired.

```javascript
  onBack: function(ev) {
    WinJS.Navigation.back();
    // Do something else...
  }
```

Or instead of binding a controller method, you can run a snippet of code:

```html
  <div id="somemarkup">
    <button data-win-motown-actions="{ click: 'WinJS.Navigation.back();' }">Back</button>
  </div>
```

The snippet runs in the scope of the Page's controller.

## Documentation ##

+ [API Documentation](http://mtilchen.github.com/motown)
+ [Intro to Motown + tutorial on navigation and application configuration](http://labs.vectorform.com/2012/07/motown-easy-javascript-apps-for-metro-part-1/)

## Download ##

[Download the latest stable release](https://github.com/mtilchen/motown/zipball/v0.1.2)

## License ##

Motown is distributed under the LGPL v3 license. Please refer to the included 'LICENSE' file for more information.
