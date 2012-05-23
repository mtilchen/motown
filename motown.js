/*
 * Copyright 2012, Motor City Code Foundry, LLC
 *
 * This file is part of Motown.
 *
 * Motown is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Motown is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * bundled with Motown.  If not, see <http://www.gnu.org/licenses/>.
 */

(function () {
  "use strict";

  var controllerCache = [],
      contentLoadedPromise;

  WinJS.Namespace.define('MT', {
    AppController: WinJS.Class.define(function (element, config) {

      MT.apply(this, config || {});

      if (!Array.isArray(this.pages) || !this.pages.length) {
        throw 'You must include an array of "pages" in your configuration';
      }

      Object.defineProperties(this, {
        _pageDefs:          { value: {},      enumerable: false, configurable: false, writable: false },
        _pageMap:           { value: {},      enumerable: false, configurable: false, writable: false },
        _controllerCtorMap: { value: {},      enumerable: false, configurable: false, writable: false },
        _element:           { value: element, enumerable: false, configurable: false, writable: false }
      });

      // Setup page definitions
      for (var i = 0, l = this.pages.length; i < l; i++) {
        var def = this.pages[i];
        if (typeof def === 'string') {
          this._pageDefs[def] = {}; // Empty definition, uses defaults
        }
        else if (def && (typeof def === 'object')) {
          this._pageDefs[def.name] = def;
        }
      }

      // Register with WinJS nav system
      var me = this;
      WinJS.Navigation.addEventListener('beforenavigate', function (e) {
        me.onBeforeNavigate(e.detail.location, e.detail.state, e);
      });
      WinJS.Navigation.addEventListener('navigating', function (e) {
        me.onNavigate(e.detail.location, e.detail.state, e);
      });

      // Setup the app's namespace if specified
      if ((typeof this.namespace === 'string') && this.namespace.length) {
        this.namespace = WinJS.Namespace.define(this.namespace);
      }
      else {
        this.namespace = window;
      }

      // Add key listeners that listen on the bubble up phase, allowing other listeners to go the first.
      // Dispatch to the active controller, The active controller is the one associated with the currently
      // active view. It should be the only one present in the DOM
      ['keypress', 'keyup', 'keydown'].forEach(function(ename) {
        var methodName = 'key' + ename[3].toUpperCase() + ename.slice(4);
        document.body.addEventListener(ename, function(ev) {
          var view = WinJS.Utilities.query('div[data-motown-owner-index]')[0],
              idx = parseInt(view.getAttribute('data-motown-owner-index')),
              controller = controllerCache[idx];
          controller[methodName](ev);
        }, false);
      });
      // Setup converter functions for use in bindings
      Object.keys(this.converters || {}).forEach(function(name) {
        me.converters[name] = new WinJS.Binding.converter(me.converters[name]);
      });
    },{
      // Information about the applications activation, save from the activation event
      activationDetails: null,
      // The page name to initially navigate to
      homePage: 'home',
      // Maps the page's name to an index of a controller in the controllerCache
      _pageMap: null,
      _activeController: null,
      _controllerCtorMap: null,
      // Find a controller constructor function for the given page name
      _resolveController: function(name) {

        var controllerClassName = (name.charAt(0).toUpperCase() + name.slice(1) + 'Controller'),
            pageDef = this._pageDefs[name],
            controllerCtorKey = pageDef.controller || controllerClassName,
            ctor = this._controllerCtorMap[controllerCtorKey];

        // We have already resolved a controller with this key
        if (ctor) {
          return ctor;
        }

        // Load controller JS file dynamically before looking for the constructor function
        var s = document.createElement('script'),
            head = document.getElementsByTagName('head')[0],
            // 'a.b.c.ControllerName -> controllers/a/b/c/ControllerName.js
            path = 'controllers/' + controllerCtorKey.replace('.', '/') + '.js',
            resourceMap = Windows.ApplicationModel.Resources.Core.ResourceManager.current.mainResourceMap;

        try {
          if (resourceMap.hasKey('Files/' + path)) {
            s.setAttribute('src', path);
            // This should be asynchronous but isn't in this environment, so no need for a Promise
            head.appendChild(s);
          }
        }
        catch (e) { /* This should not throw according to the docs, but it does. We can safely ignore it. */ }

        // Use 'controllerClass' when fully qualified name for a controller class differs from its path on disk
        if (pageDef.controllerClass) {
          ctor = WinJS.Utilities.getMember(pageDef.controllerClass, window);
          if (!ctor) {
            throw new Error('Controller class could not be found: ' + pageDef.controllerClass);
          }
        }
        else {
          // Look for specified controller in our namespace -> conventional name in our namespace -> default
          ctor = this.namespace[pageDef.controller] || this.namespace[controllerClassName] || MT.PageController;
        }

        // Cache the resolution
        this._controllerCtorMap[controllerCtorKey] = ctor;
        return ctor;
      },
      // Loads the page's view and controller, returns the controller
      _loadPage: function(name) {
        var controller = controllerCache[this._pageMap[name]],
            def = this._pageDefs[name],
            self = this;

        if (!controller) {

          if (!def) {
            throw new Error('No page definition found for: ' + name);
          }

          return MT.loadView(def.view || name).then(function(viewEl) {

            // This must be done after the view has loaded because the controller's code may be loaded in a script tag in the view
            var ctor = self._resolveController(name),
                idx = controllerCache.length;

             controller = controllerCache[idx] = new ctor(viewEl, def.config);
             self._pageMap[name] = idx;
             viewEl.setAttribute('data-motown-owner-index', idx);
             return WinJS.UI.processAll(viewEl);
            }).then(function() {
              controller._initView();
              return controller;
          });
        }
        else {
          return WinJS.Promise.wrap(controller);
        }
      },
        // Runs after DOMContentLoaded, use it to initialize global state
      init: function() {},
      onActivation: function (kind, previousState, e) {
        if (kind === Windows.ApplicationModel.Activation.ActivationKind.launch) {
          WinJS.Navigation.navigate(this.homePage);
        }
      },
      onCheckpoint: function(event) {}, // AKA onSuspending
      onResume: function(event) {},
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
            previous, previousIdx, // previousIdx === index of previous controller in controllerCache
            context = {},
            me = this;

        if (delta < 0) { // User went back
          previousIdx = this._pageMap[forwardStack[Math.max(0, forwardStack.length + delta)].location];
        }
        else if (delta > 0) { // User went forward
          previousIdx = this._pageMap[backStack[Math.max(0, backStack.length - delta)].location];
        }
        else {  // User used 'navigate'
          context = Object.create(state || {});
          previousIdx = backStack.length ? this._pageMap[backStack[backStack.length - 1].location]
                                         : null;
        }

        previous = controllerCache[previousIdx];

        this._loadPage(location).done(function (controller) {
          if (previous) {
            WinJS.Promise.as(previous.beforeNavigateOut(context)).then(function() {
                me._element.removeChild(me._element.firstElementChild);
                return WinJS.Promise.as(previous.afterNavigateOut(context));
            }).then(function() {
              me._element.appendChild(controller.viewEl);
              return WinJS.Promise.as(controller.beforeNavigateIn(context)).then(function() {
                return controller._processBindings();
              });
            }).done(function() {
              controller.afterNavigateIn(context);
            });
         }
         else {
            me._element.appendChild(controller.viewEl);
            WinJS.Promise.as(controller.beforeNavigateIn(context)).then(function() {
             return controller._processBindings();
           }).done(function () {
             controller.afterNavigateIn(context);
          });
         }
        });
      }
    }),

    apply: function(dst, src) {
      var props = Object.keys(src || {}),
          i, l;

      for (i = 0, l = props.length; i < l; i++) {
        Object.defineProperty(dst, props[i], Object.getOwnPropertyDescriptor(src, props[i]));
      }
      return dst;
    },

    // Returns a Promise w/ completion value of the loaded view's element (WinJS.UI.processAll is NOT called)
    loadView: function(view) {
      var viewName = view.replace(/.html$/,''),
          viewPath = '/views/' + viewName + '.html',
          viewEl = document.createElement('div');

      WinJS.Utilities.addClass(viewEl, 'motown-view');
      WinJS.Utilities.addClass(viewEl, viewName.replace('/', '-')); // View @ /views/viewcategory/viewname.html gets class: viewcategory-viewname

      return WinJS.UI.Fragments.renderCopy(viewPath, viewEl);
    },

    // Takes a view name and controller instance, loads the view and hooks it up to the controller and returns a Promise that provides the controller as its value
    loadPage: function(view, controller) {
      if (view && controller) {
        return MT.loadView(view).then(function (viewEl) {
            var idx = controllerCache.length;

            controllerCache[idx] = controller;
            viewEl.setAttribute('data-motown-owner-index', idx);
            return WinJS.UI.processAll(viewEl);

          }).then(function(viewEl) {
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
          pairs[i] = [names[i], encodeURIComponent(params[names[i]])].join('=');
        }
        return [base, pairs.join('&')].join('?');
      }
      else {
        return base;
      }
    },

    //TODO: Make this more general purpose
    findParent: function(startEl) {
      if (startEl) {
        if (startEl.hasAttribute('data-motown-owner-index')) {
          return startEl;
        }
        else {
          return MT.findParent(startEl.parentNode);
        }
      }
      else  { return null; }
    },

    configApp: function(config) {
      contentLoadedPromise = WinJS.Utilities.ready(function() {
        var hostEl = document.createElement('div');
        hostEl.style.width = hostEl.style.height = '100%';
        hostEl.style.backgroundColor = 'rgba(0,0,0,0)';
        hostEl.id = 'motownapp-host';
        document.body.appendChild(hostEl);

        MT.App = new MT.AppController(hostEl, config);
        Object.freeze(MT);
        MT.App.init();
      });
    },

    App: null, // The singleton instance of an ApplicationController representing the application

    //TODO: Need dispose() method
    PageController: WinJS.Class.define(function (element, config) {
      MT.apply(this, config);
      Object.defineProperties(this, {
        viewEl:  { value: element,     writable: !element, enumerable: true, configurable: false },
        refs:    { value: {},          writable: false,    enumerable: true, configurable: false }
      });
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
      _processBindings: function() {
        var bindEls = WinJS.Utilities.query('*[data-motown-bindsource]', this.viewEl),
            promises = [],
            self = this;

        bindEls.forEach(function(el) {
          var modelPath = el.getAttribute('data-motown-bindsource'),
              parent, prop,
              model = self;

          if (!modelPath) {
            throw 'Model path must be specified';
          }

          modelPath.split('.').forEach(function (path) {
            parent = model;
            model = parent[path];
            if (!model) {
              throw 'Model path could not be found: ' + modelPath;
            }
            prop = path;
          });

          model = WinJS.Binding.as(model);
          parent[prop] = model; // Replace the model object with the ObservableProxy
          promises[promises.length] = WinJS.Binding.processAll(el, model);
        });
        return WinJS.Promise.join(promises);
      },
      _initView: function() {
        if (this.viewEl) {
          this._processRefs();
          this._processActions();
          this.viewReady(this.viewEl);
        }
      },
      viewReady: function(view) {},
      beforeNavigateIn: function(context) {},
      afterNavigateIn: function(context) {},
      beforeNavigateOut: function(context) {},
      afterNavigateOut: function(context) {},
      keyPress: function (e) {},
      keyUp: function(e) {},
      keyDown: function (e) { },
      viewEl: null,
      refs: null
    })
  });

  // IListDataAdapter implementation used by KeyedDataSource below
  var keyedDataAdapter = WinJS.Class.define(function(items, options) {
    options = options || {};
    this._binding = options.binding;
    this._keyProperty = options.keyProperty || 'key';

    this._initItems(items, true);
  },{
    beginEdits: function() {
      this._editing = true;
    },
    endEdits: function() {
      this._editing = false;
    },
    setNotificationHandler: function(handler) {
      this._notificationHandler = handler;
    },
    getCount: function() {
      return WinJS.Promise.wrap(this._items.length);
    },
    itemsFromIndex: function(requestIndex, countBefore, countAfter) {
      var len = this._items.length;

      if (requestIndex >= len || requestIndex < 0) {
        return WinJS.Promise.wrapError(new WinJS.ErrorFromName(WinJS.UI.FetchError.doesNotExist));
      }

      return WinJS.Promise.wrap({
        items: this._items.slice(0, len),
        offset: requestIndex,
        totalCount: len
      });
    },
    itemsFromKey: function(key, countBefore, countAfter, hints) {
      var item = this._keyMap[key];

      if (!item) {
        var err = new WinJS.ErrorFromName(WinJS.UI.FetchError.doesNotExist);
        err.key = key;
        return WinJS.Promise.wrapError(err);
      }

      return WinJS.Promise.wrap({
        items: this._items.slice(0, this._items.length),
        offset: item.index,
        absoluteIndex: item.index,
        totalCount: this._items.length
      });
    },
    insertAtEnd: function(key, data) {
      var item = {
        data: data,
        key: key || data[this._keyProperty]
      };

      this._items.push(item);
      this._keyMap[item.key] = item;

      return WinJS.Promise.wrap(item);
    },
    moveAfter: function(key, prevKey, currIdx, prevItemIdx) {
      var item = this._keyMap[key],
          newIdx = prevItemIdx + 1,
          delta = (newIdx > currIdx ? 0 : 1);

      if (item._moved) {
        delete item._moved;
      }
      else {
        this._items.splice(newIdx, 0, item);
        this._items.splice(currIdx + delta, 1);
      }

      return WinJS.Promise.wrap(null);
    },
    moveToStart: function(key) {
      var item = this._keyMap[key];

      // Index may not have been assigned by WinJS Datasource internals yet
      if (typeof item.index !== 'number') {
        item.index = this._findIndex(item);
      }
      if (item._moved) {
        delete item._moved;
      }
      else if (item.index > 0) {
        this._items.splice(item.index, 1);
        this._items.splice(0, 0, item);
      }
      return WinJS.Promise.wrap(null);
    },
    moveToEnd: function(key) {
      var item = this._keyMap[key];

      // Index may not have been assigned by WinJS Datasource internals yet
      if (typeof item.index !== 'number') {
        item.index = this._findIndex(item);
      }
      if (item._moved) {
        delete item._moved;
      }
      else if (item.index < (this._items.length - 1)) {
        this._items.splice(item.index, 1);
        this._items.push(item);
      }
      return WinJS.Promise.wrap(null);
    },
    remove: function(key) {
      var item = this._keyMap[key],
          items = this._items,
          idx;

      if (item) {
        if (item.hasOwnProperty('index')) {
          idx = item.index;
        }
        else {
          idx = this._findIndex(item);
        }
        if (idx >= 0) {
          items.splice(idx, 1);
          delete this._keyMap[key];
        }
      }
      return WinJS.Promise.wrap(null);
    },
    // 30% faster than 'indexOf' on IE 10
    _findIndex: function(item) {
      var items = this._items,
          len = items.length,
          i;

      for (i = 0; i < len; i++) {
        if (item === items[i]) {
          return i;
        }
      }
      return -1;
    },
    _initItems: function(data, preventReload) {
      var key, items, i, l;

      this._items = items = Array.isArray(data) ? data : [];
      this._keyMap = {};

      // Turn all the plain objects into WinJS.UI.IItem-like objects, making them bindable if configured to
      for (i = 0, l = items.length; i < l; i++) {
        key = items[i][this._keyProperty];
        items[i] = {
          key: key,
          data: this._binding ? WinJS.Binding.as(items[i]) : items[i]
        };
        this._keyMap[key] = items[i];
      }

      if (!preventReload) { this._notificationHandler.reload(); }
    }
  });

  WinJS.Namespace.defineWithParent(MT, 'UI', {
    // Allows users to specify "dot separated" paths to WinJS.UI.ListView datasources as Strings in data-win-options.
    // For templates, the Strings are interpreted as DOM ids or paths relative to the owner controller's refs object.
    // Paths for datasources are relative to the owning controller. The owner controller is found by
    // looking up the ListView's ancestry for the containing "view" and retrieving the controller from the cache with
    // the value of the 'data-motown-owner-index' attribute for the first 'view' element found in the ancestry.
    // A 'view' is any element with a value specified for the attribute 'data-motown-owner-index'.
    ListView: WinJS.Class.derive(WinJS.UI.ListView, function(el, config) {

      var containingView,
          viewOwner;

      if (el) {
        containingView = MT.findParent(el);
        if (containingView) {
          var idx = parseInt(containingView.getAttribute('data-motown-owner-index'));
          viewOwner = controllerCache[idx];
        }
        else {
          throw 'Could not find a containing view for this control';
        }
      }
      config = config || {};
      // Resolve references to the datasources contained in the controller and then call the constructor for WinJS.UI.ListView
      if (typeof config.itemDataSource === 'string') {
        config.itemDataSource = WinJS.Utilities.getMember(config.itemDataSource, viewOwner);
      }
      if (typeof config.groupDataSource === 'string') {
        config.groupDataSource = WinJS.Utilities.getMember(config.groupDataSource, viewOwner);
      }
      // Resolve references to the templates as a ref or with DOM identity
      if (typeof config.itemTemplate === 'string') {
        config.itemTemplate = (viewOwner.refs[config.itemTemplate] || {}).element ||
                               WinJS.Utilities.query('#' + config.itemTemplate, containingView).get(0);
      }
      if (typeof config.groupHeaderTemplate === 'string') {
        config.groupHeaderTemplate = (viewOwner.refs[config.groupHeaderTemplate] || {}).element ||
                                     WinJS.Utilities.query('#' + config.groupHeaderTemplate, containingView).get(0);
      }
      this._super.constructor.call(this, el, config);
    }),
    KeyedDataSource: WinJS.Class.derive(WinJS.UI.VirtualizedDataSource, function(items, options) {

      var adapter = new keyedDataAdapter(items, options);
      this._baseDataSourceConstructor(adapter);

      // Use the closure pattern here as MS went to great lengths not to expose the adapter in the datasource, let's do the same
      this.containsKey = function(key) {
        return !!adapter._keyMap[key];
      };
      this.getKeys = function() {
        return Object.keys(adapter._keyMap);
      };
      this.get = function(key) {
        return (adapter._keyMap[key] || {}).data;
      };
      this.getAt = function(idx) {
        return (adapter._items[idx] || {}).data;
      };
      this.setData = function(data) {
        adapter._initItems(data);
      };
      this.sort = function(sortFn) {
        var len = adapter._items.length,
            editing = adapter._editing,
            items = adapter._items,
            item, prevKey,
            i;

        items.sort(function(a, b) {
          return sortFn(a.data, b.data);
        });

        // Look for items that changed position due to the sort.
        if (!editing) {
          this.beginEdits();
        }
        for (i = 0; i < len; i++) {
          item = items[i];
          if (i !== item.index) {
            prevKey = (i === 0 ? null : items[i - 1].key);
            if (!prevKey) {
              // This is item has already been moved in the array by the sort.
              // Mark it so the moveToStart function will not try to move it again.
              item._moved = true;
              this.moveToStart(item.key);
            }
            else {
              // See above
              item._moved = true;
              this.moveAfter(item.key, prevKey);
            }
          }
        }
        if (!editing) {
          this.endEdits();
        }
      };
      Object.defineProperty(this, 'length', {
        get: function() {
          return adapter._items.length;
        },
        configurable: false
      });
    })
  });

  Object.preventExtensions(MT);
  Object.freeze(MT.UI);

  // Set up a debug log, turn on first chance exceptions and log uncaught exceptions
  if (window.Debug && console.dir) { // We are running in a debug configuration
    Debug.enableFirstChanceException(true);
    WinJS.Utilities.startLog('debug');
    console.debug = function(msg) {
      var log = ['[', (new Date()).toISOString(), ']: ', msg];
      WinJS.log(log.join(''), 'debug');
    };

    WinJS.Promise.onerror = function(e) {
      var ex = e.detail.exception || e.detail.error,
        i, len;

      ex = Array.isArray(ex) ? ex : [ex];

      for (i = 0, len = ex.length; i < len; i++) {
        if (ex[i] && (ex[i] instanceof Error)) {
          if (ex[i].stack) {
            console.error(ex[i].stack);
          }
          else {
            console.error(ex[i].name + ': ' + ex[i].message);
          }
        }
      }
    };

    window.onerror = function(msg, url, line) {
      console.error('Error: ' + msg);
      console.error('File: ' + url);
      console.error('Line: ' + line);
    };
  }
  else {
    console.debug = function() { /* no-op */ };
  }

  WinJS.Application.onactivated = function(e) {
    // Save the launch information so the rest of the app can look at it if needed
      contentLoadedPromise.done(function() {
        Object.defineProperty(MT.App, 'activationDetails', {
          value: e.detail,
          enumerable: true,
          configurable: false,
          writable: false
        });
        MT.App.onActivation(e.detail.kind, e.detail.previousExecutionState, e);
      });
  };

  WinJS.Application.oncheckpoint = function(e) {
    MT.App.onCheckpoint(e);
  };

  // WinJS does not expose "resuming" in the WinJS.Application object
  Windows.UI.WebUI.WebUIApplication.onresuming = function(e) {
    MT.App.onResume(e);
  };

  WinJS.Application.start();
})();