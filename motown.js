/*
 * Copyright 2012, Motor City Code Foundry, LLC
 *
 * This file is part of Motown.
 *
 * Motown is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * Motown is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public License
 *  along with Motown.  If not, see <http://www.gnu.org/licenses/>.
 */

(function () {
  "use strict";

  var app = WinJS.Application,
      loadPromise;

  // TODO: Logging with WinJS.Utilities.startLog and WinJS.log (trace, debug, info, warning, error), allow
  WinJS.Namespace.define('MT', {
    AppController: WinJS.Class.define(function (element, config) {

      MT.apply(this, config || {});

      if (!this.pages || !this.pages.length) {
        throw new Error('You must include an array of "pages" in your configuration');
      }

      Object.defineProperties(this, {
        _pageDefs:      { value: {},      enumerable: false, configurable: false, writable: false },
        _controllerMap: { value: {},      enumerable: false, configurable: false, writable: false },
        _element:       { value: element, enumerable: false, configurable: false, writable: false }
      });

      // Setup page definitions
      for (var i = 0, l = this.pages.length; i < l; i++) {
        var def = this.pages[i];
        if (typeof def === 'string') {
          this._pageDefs[def] = { config: {} }; // Empty definition, uses defaults
        }
        else if (def && (typeof def === 'object')) {
          def.config = def.config || {};
          this._pageDefs[def.name] = def;
        }
      }

      // Register with WinJS nav system
      var self = this;
      WinJS.Navigation.addEventListener('beforenavigate', function (e) {
        self.onBeforeNavigate(e.detail.location, e.detail.state, e);
      });
      WinJS.Navigation.addEventListener('navigating', function (e) {
        self.onNavigate(e.detail.location, e.detail.state, e);
      });

      // Setup the app's namespace if specified
      if (typeof this.namespace === 'string') {
        this.namespace = WinJS.Namespace.define(this.namespace);
      }
      else {
        this.namespace = window;
      }
    },{
      // Information about the applications activation, save from the activation event
      activationDetails: null,
      // The page name to initially navigate to
      homePage: 'home',
      // Maps the page's name to an instance of a controller
      _controllerMap: null,
      // Find a controller constructor function for the given page name
      _resolveController: function(name) {

        var controllerClassName = (name.charAt(0).toUpperCase() + name.slice(1) + 'Controller'),
            def = this._pageDefs[name],
            ctor;

        if (def.controller) { // User specfified controller class
          if (this.namespace[def.controller]) {
            ctor = this.namespace[def.controller]; // We found the controller in the application's namespace
          }
          else {  // User may have specified a fully qualified name or a controller from another namespace
            ctor = window;
            def.controller.split('.').forEach(function(path) {
              ctor = ctor[path];
              if (!ctor) {
                throw new Error ('Controller could not be found: ' + def.controller);
              }
            });
          }
        }
        else if (this.namespace[controllerClassName]) { // Look for a controller name following naming conventions
          ctor = this.namespace[controllerClassName];
        }
        else { // Use the default controller by default
          ctor = MT.BaseController;
        }
        return ctor;
      },
      // Loads the page's view and controller, returns the controller
      _loadPage: function(name) {
        var controller = this._controllerMap[name],
            def = this._pageDefs[name],
            self = this;

        if (!controller) {

          if (!def) {
            throw new Error('No page definition found for: ' + name);
          }

          return MT.loadView(def.view || name).then(function(viewEl) {

            // This must be done after the view has loaded because the controller's code may be loaded in a script tag in the view
            var ctor = self._resolveController(name);

             return self._controllerMap[name] = new ctor(viewEl, def.config);
          });
        }
        else {
          return WinJS.Promise.wrap(controller);
        }
      },
      onActivation: function (kind, previousState, e) {
        // Save the launch information so the rest of the app can look at it if needed
        if (kind === Windows.ApplicationModel.Activation.ActivationKind.launch) {
          WinJS.Navigation.navigate(this.homePage);
        }
      },
      onCheckpoint: function(event) {},
      onBeforeNavigate: function (location, state, e) {

        console.debug('Before navigation from: ' + WinJS.Navigation.location + ' to: ' + location);
        if (!this._pageDefs[location]) {
          e.preventDefault();
          //throw new Error('Unknown controller name: ' + location);
        }
      },
      onNavigate: function (location, state, e) {

        console.debug('Navigating to: ' + location);
        var backStack = WinJS.Navigation.history.backStack,
            forwardStack = WinJS.Navigation.history.forwardStack,
            delta = e.detail.delta,
            previous,
            self = this;

        if (delta < 0) { // User went back
          previous = this._controllerMap[forwardStack[Math.max(0, forwardStack.length + delta)].location];
        }
        else if (delta > 0) { // User went forward
          previous = this._controllerMap[backStack[Math.max(0, backStack.length - delta)].location];
        }
        else {  // User used 'navigate'
          previous = backStack.length ? this._controllerMap[backStack[backStack.length - 1].location]
                                      : null;
        }

        this._loadPage(location).done(function (controller) {
          if (previous) {
            WinJS.Promise.as(previous.beforeNavigateOut()).done(function() {
              self._element.removeChild(self._element.firstElementChild);
            });
          }

          self._element.appendChild(controller.viewEl);
          WinJS.Promise.as(controller.beforeNavigateIn()).done(function() {
            controller.afterNavigateIn();
            if (previous) {
              previous.afterNavigateOut();
            }
          });
        });
      }
    }),

    apply: function(dst, src) {
      var props = Object.keys(src),
          i, l;

      for (i = 0, l = props.length; i < l; i++) {
        Object.defineProperty(dst, props[i], Object.getOwnPropertyDescriptor(src, props[i]));
      }
      return dst;
    },

    loadView: function(view) {
      var viewName = view.replace(/.html$/,''),
          viewPath = '/views/' + viewName + '.html',
          viewEl = document.createElement('div');

      WinJS.Utilities.addClass(viewEl, 'motown-view');
      WinJS.Utilities.addClass(viewEl, viewName.replace('/', '-')); // View @ /views/viewcategory/viewname.html gets class: viewcategory-viewname

      return WinJS.UI.Fragments.renderCopy(viewPath, viewEl).then(function() {
        return WinJS.UI.processAll(viewEl);
      });
    },

    // Takes a view name and controller instance, loads the view and hooks it up to the controller and returns a Promise that provides the controller as its value
    loadPage: function(view, controller) {
      if (view && controller) {
        return MT.loadView(view).then(function (viewEl) {
          controller.viewEl = viewEl;
          controller._initView();
          return controller;
        });
      }
      else {
        throw 'You must provide a view name and a controller instance to connect it to';
      }
    },

    dialog: function(msg, title, commands, defaultIdx, cancelIdx) {
      //TODO: Turn this into a single 'options' argument and document
      var md = new Windows.UI.Popups.MessageDialog(msg),
          i,l;

      if (title) {
        md.title = title;
      }

      if (Array.isArray(commands)) {
        for (i = 0, l = Math.min(commands.length, 3); i < l; i++) {
          md.commands.append(new Windows.UI.Popups.UICommand(commands[i], null, i));
        }
      }

      if (defaultIdx) {
        md.defaultCommandIndex = defaultIdx;
      }
      if (cancelIdx) {
        md.cancelCommandIndex = cancelIdx;
      }

      return md.showAsync();
    },

    toURL: function(base, params) {
      var names = Object.keys(params || {}),
          pairs = new Array(names.length),
          i, l;

      if (names.length) {
        for (i = 0, l = names.length; i < l; i++) {
          pairs[i] = [names[i], params[names[i]]].join('=');
        }
        return [base, pairs.join['&']].join('?');
      }
      else {
        return base;
      }
    },

    configApp: function(config) {
      loadPromise = WinJS.Utilities.ready(function() {
        var hostEl = document.createElement('div');
        hostEl.style.width = hostEl.style.height = '100%';
        hostEl.style.backgroundColor = 'rgba(0,0,0,0)';
        hostEl.id = 'motownapp-host';
        document.body.appendChild(hostEl);

        MT.App = new MT.AppController(hostEl, config);
        Object.freeze(MT);
      });
    },

    App: null, // The singleton instance of an ApplicationController representing the application

    BaseController: WinJS.Class.define(function (element, config) {
      MT.apply(this, config);
      Object.defineProperties(this, {
        viewEl:  { value: element,     writable: !element, enumerable: true, configurable: false },
        refs:    { value: {},          writable: false,    enumerable: true, configurable: false }
      });

      this._initView();
    },{
      _processRefs: function() {
        var refEls = WinJS.Utilities.query('*[data-motown-ref]', this.viewEl),
            self = this;

        refEls.forEach(function(el) {
          self.refs[el.getAttribute('data-motown-ref')] = el.winControl || el;
        });
      },
      _processActions: function() {
        var actionEls = WinJS.Utilities.query('*[data-motown-actions]', this.viewEl),
            self = this;

        actionEls.forEach(function(el) {
          var actions = WinJS.UI.optionsParser(el.getAttribute('data-motown-actions'));

          el = el.winControl || el;

          // keys are event names, value is either a name of a controller method or a code snippet for a dynamic function body
          Object.keys(actions).forEach(function(eName) {
            var action = actions[eName];
            // The controller has a method matching the action name
            if (typeof self[action] === 'function') {
              el.addEventListener(eName, function(e) {
                self[action](e);
              }, false);
            }
            // Otherwise, the action is a string for a dynamic function
            else {
              var dynamicFunc = new Function('e', action);
              el.addEventListener(eName, function(e) {
                dynamicFunc.call(self, e);
              }, false);
            }
          });
        });
      },
      _initView: function() {
        if (this.viewEl) {
          this._processRefs();
          this._processActions();
          this.viewReady();
        }
      },
      viewReady: function() {},
      beforeNavigateIn: function() {},
      afterNavigateIn: function() {},
      beforeNavigateOut: function() {},
      afterNavigateOut: function() {},
      viewEl: null,
      refs: null
    })
  });

  Object.preventExtensions(MT);

  // Set up a debug log and turn on first chance exceptions
  if (console.dir) { // We are running in a debug configuration
    Debug.enableFirstChanceException(true);
    WinJS.Utilities.startLog('debug');
    console.debug = function(msg) {
      var log = ['[', (new Date()).toISOString(), ']: ', msg];
      WinJS.log(log.join(''), 'debug');
    };
  }
  else {
    console.debug = function() { /* no-op */ };
  }

  app.onactivated = function (e) {
      loadPromise.done(function() {
        Object.defineProperty(MT.App, 'activationDetails', {
          value: e.detail,
          enumerable: true,
          configurable: false,
          writable: false
        });
        MT.App.onActivation(e.detail.kind, e.detail.previousExecutionState, e);
      });
  };

  app.oncheckpoint = function (e) {
    MT.App.onCheckpoint(e);
  };

  app.start();
})();

