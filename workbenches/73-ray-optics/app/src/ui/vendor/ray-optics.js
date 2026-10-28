var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// app/node_modules/.pnpm/i18next@23.16.8/node_modules/i18next/dist/esm/i18next.js
var isString, defer, makeString, copy, lastOfPathSeparatorRegExp, cleanKey, canNotTraverseDeeper, getLastOfPath, setPath, pushPath, getPath, getPathWithDefaults, deepExtend, regexEscape, _entityMap, escape, RegExpCache, chars, looksLikeObjectPathRegExpCache, looksLikeObjectPath, deepFind, getCleanedCode, consoleLogger, Logger, baseLogger, EventEmitter, ResourceStore, postProcessor, checkedLoadedFor, Translator, capitalize, LanguageUtil, sets, _rulesPluralsTypes, nonIntlVersions, intlVersions, suffixesOrder, createRules, PluralResolver, deepFindWithDefaults, regexSafe, Interpolator, parseFormatStr, createCachedFormatter, Formatter, removePending, Connector, get, transformOptions, noop, bindMemberFunctions, I18n, instance, createInstance, dir, init, loadResources, reloadResources, use, changeLanguage, getFixedT, t2, exists, setDefaultNamespace, hasLoadedNamespace, loadNamespaces, loadLanguages;
var init_i18next = __esm({
  "app/node_modules/.pnpm/i18next@23.16.8/node_modules/i18next/dist/esm/i18next.js"() {
    isString = (obj) => typeof obj === "string";
    defer = () => {
      let res;
      let rej;
      const promise = new Promise((resolve, reject) => {
        res = resolve;
        rej = reject;
      });
      promise.resolve = res;
      promise.reject = rej;
      return promise;
    };
    makeString = (object) => {
      if (object == null) return "";
      return "" + object;
    };
    copy = (a, s, t3) => {
      a.forEach((m) => {
        if (s[m]) t3[m] = s[m];
      });
    };
    lastOfPathSeparatorRegExp = /###/g;
    cleanKey = (key) => key && key.indexOf("###") > -1 ? key.replace(lastOfPathSeparatorRegExp, ".") : key;
    canNotTraverseDeeper = (object) => !object || isString(object);
    getLastOfPath = (object, path, Empty) => {
      const stack = !isString(path) ? path : path.split(".");
      let stackIndex = 0;
      while (stackIndex < stack.length - 1) {
        if (canNotTraverseDeeper(object)) return {};
        const key = cleanKey(stack[stackIndex]);
        if (!object[key] && Empty) object[key] = new Empty();
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          object = object[key];
        } else {
          object = {};
        }
        ++stackIndex;
      }
      if (canNotTraverseDeeper(object)) return {};
      return {
        obj: object,
        k: cleanKey(stack[stackIndex])
      };
    };
    setPath = (object, path, newValue) => {
      const {
        obj,
        k
      } = getLastOfPath(object, path, Object);
      if (obj !== void 0 || path.length === 1) {
        obj[k] = newValue;
        return;
      }
      let e = path[path.length - 1];
      let p = path.slice(0, path.length - 1);
      let last = getLastOfPath(object, p, Object);
      while (last.obj === void 0 && p.length) {
        e = `${p[p.length - 1]}.${e}`;
        p = p.slice(0, p.length - 1);
        last = getLastOfPath(object, p, Object);
        if (last && last.obj && typeof last.obj[`${last.k}.${e}`] !== "undefined") {
          last.obj = void 0;
        }
      }
      last.obj[`${last.k}.${e}`] = newValue;
    };
    pushPath = (object, path, newValue, concat) => {
      const {
        obj,
        k
      } = getLastOfPath(object, path, Object);
      obj[k] = obj[k] || [];
      obj[k].push(newValue);
    };
    getPath = (object, path) => {
      const {
        obj,
        k
      } = getLastOfPath(object, path);
      if (!obj) return void 0;
      return obj[k];
    };
    getPathWithDefaults = (data, defaultData, key) => {
      const value = getPath(data, key);
      if (value !== void 0) {
        return value;
      }
      return getPath(defaultData, key);
    };
    deepExtend = (target, source, overwrite) => {
      for (const prop in source) {
        if (prop !== "__proto__" && prop !== "constructor") {
          if (prop in target) {
            if (isString(target[prop]) || target[prop] instanceof String || isString(source[prop]) || source[prop] instanceof String) {
              if (overwrite) target[prop] = source[prop];
            } else {
              deepExtend(target[prop], source[prop], overwrite);
            }
          } else {
            target[prop] = source[prop];
          }
        }
      }
      return target;
    };
    regexEscape = (str) => str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    _entityMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
      "/": "&#x2F;"
    };
    escape = (data) => {
      if (isString(data)) {
        return data.replace(/[&<>"'\/]/g, (s) => _entityMap[s]);
      }
      return data;
    };
    RegExpCache = class {
      constructor(capacity) {
        this.capacity = capacity;
        this.regExpMap = /* @__PURE__ */ new Map();
        this.regExpQueue = [];
      }
      getRegExp(pattern) {
        const regExpFromCache = this.regExpMap.get(pattern);
        if (regExpFromCache !== void 0) {
          return regExpFromCache;
        }
        const regExpNew = new RegExp(pattern);
        if (this.regExpQueue.length === this.capacity) {
          this.regExpMap.delete(this.regExpQueue.shift());
        }
        this.regExpMap.set(pattern, regExpNew);
        this.regExpQueue.push(pattern);
        return regExpNew;
      }
    };
    chars = [" ", ",", "?", "!", ";"];
    looksLikeObjectPathRegExpCache = new RegExpCache(20);
    looksLikeObjectPath = (key, nsSeparator, keySeparator) => {
      nsSeparator = nsSeparator || "";
      keySeparator = keySeparator || "";
      const possibleChars = chars.filter((c) => nsSeparator.indexOf(c) < 0 && keySeparator.indexOf(c) < 0);
      if (possibleChars.length === 0) return true;
      const r = looksLikeObjectPathRegExpCache.getRegExp(`(${possibleChars.map((c) => c === "?" ? "\\?" : c).join("|")})`);
      let matched = !r.test(key);
      if (!matched) {
        const ki = key.indexOf(keySeparator);
        if (ki > 0 && !r.test(key.substring(0, ki))) {
          matched = true;
        }
      }
      return matched;
    };
    deepFind = function(obj, path) {
      let keySeparator = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : ".";
      if (!obj) return void 0;
      if (obj[path]) return obj[path];
      const tokens = path.split(keySeparator);
      let current = obj;
      for (let i = 0; i < tokens.length; ) {
        if (!current || typeof current !== "object") {
          return void 0;
        }
        let next;
        let nextPath = "";
        for (let j = i; j < tokens.length; ++j) {
          if (j !== i) {
            nextPath += keySeparator;
          }
          nextPath += tokens[j];
          next = current[nextPath];
          if (next !== void 0) {
            if (["string", "number", "boolean"].indexOf(typeof next) > -1 && j < tokens.length - 1) {
              continue;
            }
            i += j - i + 1;
            break;
          }
        }
        current = next;
      }
      return current;
    };
    getCleanedCode = (code) => code && code.replace("_", "-");
    consoleLogger = {
      type: "logger",
      log(args) {
        this.output("log", args);
      },
      warn(args) {
        this.output("warn", args);
      },
      error(args) {
        this.output("error", args);
      },
      output(type, args) {
        if (console && console[type]) console[type].apply(console, args);
      }
    };
    Logger = class _Logger {
      constructor(concreteLogger) {
        let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        this.init(concreteLogger, options);
      }
      init(concreteLogger) {
        let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        this.prefix = options.prefix || "i18next:";
        this.logger = concreteLogger || consoleLogger;
        this.options = options;
        this.debug = options.debug;
      }
      log() {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        return this.forward(args, "log", "", true);
      }
      warn() {
        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }
        return this.forward(args, "warn", "", true);
      }
      error() {
        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }
        return this.forward(args, "error", "");
      }
      deprecate() {
        for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
          args[_key4] = arguments[_key4];
        }
        return this.forward(args, "warn", "WARNING DEPRECATED: ", true);
      }
      forward(args, lvl, prefix, debugOnly) {
        if (debugOnly && !this.debug) return null;
        if (isString(args[0])) args[0] = `${prefix}${this.prefix} ${args[0]}`;
        return this.logger[lvl](args);
      }
      create(moduleName) {
        return new _Logger(this.logger, {
          ...{
            prefix: `${this.prefix}:${moduleName}:`
          },
          ...this.options
        });
      }
      clone(options) {
        options = options || this.options;
        options.prefix = options.prefix || this.prefix;
        return new _Logger(this.logger, options);
      }
    };
    baseLogger = new Logger();
    EventEmitter = class {
      constructor() {
        this.observers = {};
      }
      on(events, listener) {
        events.split(" ").forEach((event) => {
          if (!this.observers[event]) this.observers[event] = /* @__PURE__ */ new Map();
          const numListeners = this.observers[event].get(listener) || 0;
          this.observers[event].set(listener, numListeners + 1);
        });
        return this;
      }
      off(event, listener) {
        if (!this.observers[event]) return;
        if (!listener) {
          delete this.observers[event];
          return;
        }
        this.observers[event].delete(listener);
      }
      emit(event) {
        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }
        if (this.observers[event]) {
          const cloned = Array.from(this.observers[event].entries());
          cloned.forEach((_ref) => {
            let [observer, numTimesAdded] = _ref;
            for (let i = 0; i < numTimesAdded; i++) {
              observer(...args);
            }
          });
        }
        if (this.observers["*"]) {
          const cloned = Array.from(this.observers["*"].entries());
          cloned.forEach((_ref2) => {
            let [observer, numTimesAdded] = _ref2;
            for (let i = 0; i < numTimesAdded; i++) {
              observer.apply(observer, [event, ...args]);
            }
          });
        }
      }
    };
    ResourceStore = class extends EventEmitter {
      constructor(data) {
        let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {
          ns: ["translation"],
          defaultNS: "translation"
        };
        super();
        this.data = data || {};
        this.options = options;
        if (this.options.keySeparator === void 0) {
          this.options.keySeparator = ".";
        }
        if (this.options.ignoreJSONStructure === void 0) {
          this.options.ignoreJSONStructure = true;
        }
      }
      addNamespaces(ns) {
        if (this.options.ns.indexOf(ns) < 0) {
          this.options.ns.push(ns);
        }
      }
      removeNamespaces(ns) {
        const index = this.options.ns.indexOf(ns);
        if (index > -1) {
          this.options.ns.splice(index, 1);
        }
      }
      getResource(lng, ns, key) {
        let options = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {};
        const keySeparator = options.keySeparator !== void 0 ? options.keySeparator : this.options.keySeparator;
        const ignoreJSONStructure = options.ignoreJSONStructure !== void 0 ? options.ignoreJSONStructure : this.options.ignoreJSONStructure;
        let path;
        if (lng.indexOf(".") > -1) {
          path = lng.split(".");
        } else {
          path = [lng, ns];
          if (key) {
            if (Array.isArray(key)) {
              path.push(...key);
            } else if (isString(key) && keySeparator) {
              path.push(...key.split(keySeparator));
            } else {
              path.push(key);
            }
          }
        }
        const result = getPath(this.data, path);
        if (!result && !ns && !key && lng.indexOf(".") > -1) {
          lng = path[0];
          ns = path[1];
          key = path.slice(2).join(".");
        }
        if (result || !ignoreJSONStructure || !isString(key)) return result;
        return deepFind(this.data && this.data[lng] && this.data[lng][ns], key, keySeparator);
      }
      addResource(lng, ns, key, value) {
        let options = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : {
          silent: false
        };
        const keySeparator = options.keySeparator !== void 0 ? options.keySeparator : this.options.keySeparator;
        let path = [lng, ns];
        if (key) path = path.concat(keySeparator ? key.split(keySeparator) : key);
        if (lng.indexOf(".") > -1) {
          path = lng.split(".");
          value = ns;
          ns = path[1];
        }
        this.addNamespaces(ns);
        setPath(this.data, path, value);
        if (!options.silent) this.emit("added", lng, ns, key, value);
      }
      addResources(lng, ns, resources) {
        let options = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {
          silent: false
        };
        for (const m in resources) {
          if (isString(resources[m]) || Array.isArray(resources[m])) this.addResource(lng, ns, m, resources[m], {
            silent: true
          });
        }
        if (!options.silent) this.emit("added", lng, ns, resources);
      }
      addResourceBundle(lng, ns, resources, deep, overwrite) {
        let options = arguments.length > 5 && arguments[5] !== void 0 ? arguments[5] : {
          silent: false,
          skipCopy: false
        };
        let path = [lng, ns];
        if (lng.indexOf(".") > -1) {
          path = lng.split(".");
          deep = resources;
          resources = ns;
          ns = path[1];
        }
        this.addNamespaces(ns);
        let pack = getPath(this.data, path) || {};
        if (!options.skipCopy) resources = JSON.parse(JSON.stringify(resources));
        if (deep) {
          deepExtend(pack, resources, overwrite);
        } else {
          pack = {
            ...pack,
            ...resources
          };
        }
        setPath(this.data, path, pack);
        if (!options.silent) this.emit("added", lng, ns, resources);
      }
      removeResourceBundle(lng, ns) {
        if (this.hasResourceBundle(lng, ns)) {
          delete this.data[lng][ns];
        }
        this.removeNamespaces(ns);
        this.emit("removed", lng, ns);
      }
      hasResourceBundle(lng, ns) {
        return this.getResource(lng, ns) !== void 0;
      }
      getResourceBundle(lng, ns) {
        if (!ns) ns = this.options.defaultNS;
        if (this.options.compatibilityAPI === "v1") return {
          ...{},
          ...this.getResource(lng, ns)
        };
        return this.getResource(lng, ns);
      }
      getDataByLanguage(lng) {
        return this.data[lng];
      }
      hasLanguageSomeTranslations(lng) {
        const data = this.getDataByLanguage(lng);
        const n = data && Object.keys(data) || [];
        return !!n.find((v) => data[v] && Object.keys(data[v]).length > 0);
      }
      toJSON() {
        return this.data;
      }
    };
    postProcessor = {
      processors: {},
      addPostProcessor(module) {
        this.processors[module.name] = module;
      },
      handle(processors, value, key, options, translator) {
        processors.forEach((processor) => {
          if (this.processors[processor]) value = this.processors[processor].process(value, key, options, translator);
        });
        return value;
      }
    };
    checkedLoadedFor = {};
    Translator = class _Translator extends EventEmitter {
      constructor(services) {
        let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        super();
        copy(["resourceStore", "languageUtils", "pluralResolver", "interpolator", "backendConnector", "i18nFormat", "utils"], services, this);
        this.options = options;
        if (this.options.keySeparator === void 0) {
          this.options.keySeparator = ".";
        }
        this.logger = baseLogger.create("translator");
      }
      changeLanguage(lng) {
        if (lng) this.language = lng;
      }
      exists(key) {
        let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {
          interpolation: {}
        };
        if (key === void 0 || key === null) {
          return false;
        }
        const resolved = this.resolve(key, options);
        return resolved && resolved.res !== void 0;
      }
      extractFromKey(key, options) {
        let nsSeparator = options.nsSeparator !== void 0 ? options.nsSeparator : this.options.nsSeparator;
        if (nsSeparator === void 0) nsSeparator = ":";
        const keySeparator = options.keySeparator !== void 0 ? options.keySeparator : this.options.keySeparator;
        let namespaces = options.ns || this.options.defaultNS || [];
        const wouldCheckForNsInKey = nsSeparator && key.indexOf(nsSeparator) > -1;
        const seemsNaturalLanguage = !this.options.userDefinedKeySeparator && !options.keySeparator && !this.options.userDefinedNsSeparator && !options.nsSeparator && !looksLikeObjectPath(key, nsSeparator, keySeparator);
        if (wouldCheckForNsInKey && !seemsNaturalLanguage) {
          const m = key.match(this.interpolator.nestingRegexp);
          if (m && m.length > 0) {
            return {
              key,
              namespaces: isString(namespaces) ? [namespaces] : namespaces
            };
          }
          const parts = key.split(nsSeparator);
          if (nsSeparator !== keySeparator || nsSeparator === keySeparator && this.options.ns.indexOf(parts[0]) > -1) namespaces = parts.shift();
          key = parts.join(keySeparator);
        }
        return {
          key,
          namespaces: isString(namespaces) ? [namespaces] : namespaces
        };
      }
      translate(keys, options, lastKey) {
        if (typeof options !== "object" && this.options.overloadTranslationOptionHandler) {
          options = this.options.overloadTranslationOptionHandler(arguments);
        }
        if (typeof options === "object") options = {
          ...options
        };
        if (!options) options = {};
        if (keys === void 0 || keys === null) return "";
        if (!Array.isArray(keys)) keys = [String(keys)];
        const returnDetails = options.returnDetails !== void 0 ? options.returnDetails : this.options.returnDetails;
        const keySeparator = options.keySeparator !== void 0 ? options.keySeparator : this.options.keySeparator;
        const {
          key,
          namespaces
        } = this.extractFromKey(keys[keys.length - 1], options);
        const namespace = namespaces[namespaces.length - 1];
        const lng = options.lng || this.language;
        const appendNamespaceToCIMode = options.appendNamespaceToCIMode || this.options.appendNamespaceToCIMode;
        if (lng && lng.toLowerCase() === "cimode") {
          if (appendNamespaceToCIMode) {
            const nsSeparator = options.nsSeparator || this.options.nsSeparator;
            if (returnDetails) {
              return {
                res: `${namespace}${nsSeparator}${key}`,
                usedKey: key,
                exactUsedKey: key,
                usedLng: lng,
                usedNS: namespace,
                usedParams: this.getUsedParamsDetails(options)
              };
            }
            return `${namespace}${nsSeparator}${key}`;
          }
          if (returnDetails) {
            return {
              res: key,
              usedKey: key,
              exactUsedKey: key,
              usedLng: lng,
              usedNS: namespace,
              usedParams: this.getUsedParamsDetails(options)
            };
          }
          return key;
        }
        const resolved = this.resolve(keys, options);
        let res = resolved && resolved.res;
        const resUsedKey = resolved && resolved.usedKey || key;
        const resExactUsedKey = resolved && resolved.exactUsedKey || key;
        const resType = Object.prototype.toString.apply(res);
        const noObject = ["[object Number]", "[object Function]", "[object RegExp]"];
        const joinArrays = options.joinArrays !== void 0 ? options.joinArrays : this.options.joinArrays;
        const handleAsObjectInI18nFormat = !this.i18nFormat || this.i18nFormat.handleAsObject;
        const handleAsObject = !isString(res) && typeof res !== "boolean" && typeof res !== "number";
        if (handleAsObjectInI18nFormat && res && handleAsObject && noObject.indexOf(resType) < 0 && !(isString(joinArrays) && Array.isArray(res))) {
          if (!options.returnObjects && !this.options.returnObjects) {
            if (!this.options.returnedObjectHandler) {
              this.logger.warn("accessing an object - but returnObjects options is not enabled!");
            }
            const r = this.options.returnedObjectHandler ? this.options.returnedObjectHandler(resUsedKey, res, {
              ...options,
              ns: namespaces
            }) : `key '${key} (${this.language})' returned an object instead of string.`;
            if (returnDetails) {
              resolved.res = r;
              resolved.usedParams = this.getUsedParamsDetails(options);
              return resolved;
            }
            return r;
          }
          if (keySeparator) {
            const resTypeIsArray = Array.isArray(res);
            const copy2 = resTypeIsArray ? [] : {};
            const newKeyToUse = resTypeIsArray ? resExactUsedKey : resUsedKey;
            for (const m in res) {
              if (Object.prototype.hasOwnProperty.call(res, m)) {
                const deepKey = `${newKeyToUse}${keySeparator}${m}`;
                copy2[m] = this.translate(deepKey, {
                  ...options,
                  ...{
                    joinArrays: false,
                    ns: namespaces
                  }
                });
                if (copy2[m] === deepKey) copy2[m] = res[m];
              }
            }
            res = copy2;
          }
        } else if (handleAsObjectInI18nFormat && isString(joinArrays) && Array.isArray(res)) {
          res = res.join(joinArrays);
          if (res) res = this.extendTranslation(res, keys, options, lastKey);
        } else {
          let usedDefault = false;
          let usedKey = false;
          const needsPluralHandling = options.count !== void 0 && !isString(options.count);
          const hasDefaultValue = _Translator.hasDefaultValue(options);
          const defaultValueSuffix = needsPluralHandling ? this.pluralResolver.getSuffix(lng, options.count, options) : "";
          const defaultValueSuffixOrdinalFallback = options.ordinal && needsPluralHandling ? this.pluralResolver.getSuffix(lng, options.count, {
            ordinal: false
          }) : "";
          const needsZeroSuffixLookup = needsPluralHandling && !options.ordinal && options.count === 0 && this.pluralResolver.shouldUseIntlApi();
          const defaultValue = needsZeroSuffixLookup && options[`defaultValue${this.options.pluralSeparator}zero`] || options[`defaultValue${defaultValueSuffix}`] || options[`defaultValue${defaultValueSuffixOrdinalFallback}`] || options.defaultValue;
          if (!this.isValidLookup(res) && hasDefaultValue) {
            usedDefault = true;
            res = defaultValue;
          }
          if (!this.isValidLookup(res)) {
            usedKey = true;
            res = key;
          }
          const missingKeyNoValueFallbackToKey = options.missingKeyNoValueFallbackToKey || this.options.missingKeyNoValueFallbackToKey;
          const resForMissing = missingKeyNoValueFallbackToKey && usedKey ? void 0 : res;
          const updateMissing = hasDefaultValue && defaultValue !== res && this.options.updateMissing;
          if (usedKey || usedDefault || updateMissing) {
            this.logger.log(updateMissing ? "updateKey" : "missingKey", lng, namespace, key, updateMissing ? defaultValue : res);
            if (keySeparator) {
              const fk = this.resolve(key, {
                ...options,
                keySeparator: false
              });
              if (fk && fk.res) this.logger.warn("Seems the loaded translations were in flat JSON format instead of nested. Either set keySeparator: false on init or make sure your translations are published in nested format.");
            }
            let lngs = [];
            const fallbackLngs = this.languageUtils.getFallbackCodes(this.options.fallbackLng, options.lng || this.language);
            if (this.options.saveMissingTo === "fallback" && fallbackLngs && fallbackLngs[0]) {
              for (let i = 0; i < fallbackLngs.length; i++) {
                lngs.push(fallbackLngs[i]);
              }
            } else if (this.options.saveMissingTo === "all") {
              lngs = this.languageUtils.toResolveHierarchy(options.lng || this.language);
            } else {
              lngs.push(options.lng || this.language);
            }
            const send = (l, k, specificDefaultValue) => {
              const defaultForMissing = hasDefaultValue && specificDefaultValue !== res ? specificDefaultValue : resForMissing;
              if (this.options.missingKeyHandler) {
                this.options.missingKeyHandler(l, namespace, k, defaultForMissing, updateMissing, options);
              } else if (this.backendConnector && this.backendConnector.saveMissing) {
                this.backendConnector.saveMissing(l, namespace, k, defaultForMissing, updateMissing, options);
              }
              this.emit("missingKey", l, namespace, k, res);
            };
            if (this.options.saveMissing) {
              if (this.options.saveMissingPlurals && needsPluralHandling) {
                lngs.forEach((language) => {
                  const suffixes = this.pluralResolver.getSuffixes(language, options);
                  if (needsZeroSuffixLookup && options[`defaultValue${this.options.pluralSeparator}zero`] && suffixes.indexOf(`${this.options.pluralSeparator}zero`) < 0) {
                    suffixes.push(`${this.options.pluralSeparator}zero`);
                  }
                  suffixes.forEach((suffix) => {
                    send([language], key + suffix, options[`defaultValue${suffix}`] || defaultValue);
                  });
                });
              } else {
                send(lngs, key, defaultValue);
              }
            }
          }
          res = this.extendTranslation(res, keys, options, resolved, lastKey);
          if (usedKey && res === key && this.options.appendNamespaceToMissingKey) res = `${namespace}:${key}`;
          if ((usedKey || usedDefault) && this.options.parseMissingKeyHandler) {
            if (this.options.compatibilityAPI !== "v1") {
              res = this.options.parseMissingKeyHandler(this.options.appendNamespaceToMissingKey ? `${namespace}:${key}` : key, usedDefault ? res : void 0);
            } else {
              res = this.options.parseMissingKeyHandler(res);
            }
          }
        }
        if (returnDetails) {
          resolved.res = res;
          resolved.usedParams = this.getUsedParamsDetails(options);
          return resolved;
        }
        return res;
      }
      extendTranslation(res, key, options, resolved, lastKey) {
        var _this = this;
        if (this.i18nFormat && this.i18nFormat.parse) {
          res = this.i18nFormat.parse(res, {
            ...this.options.interpolation.defaultVariables,
            ...options
          }, options.lng || this.language || resolved.usedLng, resolved.usedNS, resolved.usedKey, {
            resolved
          });
        } else if (!options.skipInterpolation) {
          if (options.interpolation) this.interpolator.init({
            ...options,
            ...{
              interpolation: {
                ...this.options.interpolation,
                ...options.interpolation
              }
            }
          });
          const skipOnVariables = isString(res) && (options && options.interpolation && options.interpolation.skipOnVariables !== void 0 ? options.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables);
          let nestBef;
          if (skipOnVariables) {
            const nb = res.match(this.interpolator.nestingRegexp);
            nestBef = nb && nb.length;
          }
          let data = options.replace && !isString(options.replace) ? options.replace : options;
          if (this.options.interpolation.defaultVariables) data = {
            ...this.options.interpolation.defaultVariables,
            ...data
          };
          res = this.interpolator.interpolate(res, data, options.lng || this.language || resolved.usedLng, options);
          if (skipOnVariables) {
            const na = res.match(this.interpolator.nestingRegexp);
            const nestAft = na && na.length;
            if (nestBef < nestAft) options.nest = false;
          }
          if (!options.lng && this.options.compatibilityAPI !== "v1" && resolved && resolved.res) options.lng = this.language || resolved.usedLng;
          if (options.nest !== false) res = this.interpolator.nest(res, function() {
            for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
              args[_key] = arguments[_key];
            }
            if (lastKey && lastKey[0] === args[0] && !options.context) {
              _this.logger.warn(`It seems you are nesting recursively key: ${args[0]} in key: ${key[0]}`);
              return null;
            }
            return _this.translate(...args, key);
          }, options);
          if (options.interpolation) this.interpolator.reset();
        }
        const postProcess = options.postProcess || this.options.postProcess;
        const postProcessorNames = isString(postProcess) ? [postProcess] : postProcess;
        if (res !== void 0 && res !== null && postProcessorNames && postProcessorNames.length && options.applyPostProcessor !== false) {
          res = postProcessor.handle(postProcessorNames, res, key, this.options && this.options.postProcessPassResolved ? {
            i18nResolved: {
              ...resolved,
              usedParams: this.getUsedParamsDetails(options)
            },
            ...options
          } : options, this);
        }
        return res;
      }
      resolve(keys) {
        let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        let found;
        let usedKey;
        let exactUsedKey;
        let usedLng;
        let usedNS;
        if (isString(keys)) keys = [keys];
        keys.forEach((k) => {
          if (this.isValidLookup(found)) return;
          const extracted = this.extractFromKey(k, options);
          const key = extracted.key;
          usedKey = key;
          let namespaces = extracted.namespaces;
          if (this.options.fallbackNS) namespaces = namespaces.concat(this.options.fallbackNS);
          const needsPluralHandling = options.count !== void 0 && !isString(options.count);
          const needsZeroSuffixLookup = needsPluralHandling && !options.ordinal && options.count === 0 && this.pluralResolver.shouldUseIntlApi();
          const needsContextHandling = options.context !== void 0 && (isString(options.context) || typeof options.context === "number") && options.context !== "";
          const codes = options.lngs ? options.lngs : this.languageUtils.toResolveHierarchy(options.lng || this.language, options.fallbackLng);
          namespaces.forEach((ns) => {
            if (this.isValidLookup(found)) return;
            usedNS = ns;
            if (!checkedLoadedFor[`${codes[0]}-${ns}`] && this.utils && this.utils.hasLoadedNamespace && !this.utils.hasLoadedNamespace(usedNS)) {
              checkedLoadedFor[`${codes[0]}-${ns}`] = true;
              this.logger.warn(`key "${usedKey}" for languages "${codes.join(", ")}" won't get resolved as namespace "${usedNS}" was not yet loaded`, "This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!");
            }
            codes.forEach((code) => {
              if (this.isValidLookup(found)) return;
              usedLng = code;
              const finalKeys = [key];
              if (this.i18nFormat && this.i18nFormat.addLookupKeys) {
                this.i18nFormat.addLookupKeys(finalKeys, key, code, ns, options);
              } else {
                let pluralSuffix;
                if (needsPluralHandling) pluralSuffix = this.pluralResolver.getSuffix(code, options.count, options);
                const zeroSuffix = `${this.options.pluralSeparator}zero`;
                const ordinalPrefix = `${this.options.pluralSeparator}ordinal${this.options.pluralSeparator}`;
                if (needsPluralHandling) {
                  finalKeys.push(key + pluralSuffix);
                  if (options.ordinal && pluralSuffix.indexOf(ordinalPrefix) === 0) {
                    finalKeys.push(key + pluralSuffix.replace(ordinalPrefix, this.options.pluralSeparator));
                  }
                  if (needsZeroSuffixLookup) {
                    finalKeys.push(key + zeroSuffix);
                  }
                }
                if (needsContextHandling) {
                  const contextKey = `${key}${this.options.contextSeparator}${options.context}`;
                  finalKeys.push(contextKey);
                  if (needsPluralHandling) {
                    finalKeys.push(contextKey + pluralSuffix);
                    if (options.ordinal && pluralSuffix.indexOf(ordinalPrefix) === 0) {
                      finalKeys.push(contextKey + pluralSuffix.replace(ordinalPrefix, this.options.pluralSeparator));
                    }
                    if (needsZeroSuffixLookup) {
                      finalKeys.push(contextKey + zeroSuffix);
                    }
                  }
                }
              }
              let possibleKey;
              while (possibleKey = finalKeys.pop()) {
                if (!this.isValidLookup(found)) {
                  exactUsedKey = possibleKey;
                  found = this.getResource(code, ns, possibleKey, options);
                }
              }
            });
          });
        });
        return {
          res: found,
          usedKey,
          exactUsedKey,
          usedLng,
          usedNS
        };
      }
      isValidLookup(res) {
        return res !== void 0 && !(!this.options.returnNull && res === null) && !(!this.options.returnEmptyString && res === "");
      }
      getResource(code, ns, key) {
        let options = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {};
        if (this.i18nFormat && this.i18nFormat.getResource) return this.i18nFormat.getResource(code, ns, key, options);
        return this.resourceStore.getResource(code, ns, key, options);
      }
      getUsedParamsDetails() {
        let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        const optionsKeys = ["defaultValue", "ordinal", "context", "replace", "lng", "lngs", "fallbackLng", "ns", "keySeparator", "nsSeparator", "returnObjects", "returnDetails", "joinArrays", "postProcess", "interpolation"];
        const useOptionsReplaceForData = options.replace && !isString(options.replace);
        let data = useOptionsReplaceForData ? options.replace : options;
        if (useOptionsReplaceForData && typeof options.count !== "undefined") {
          data.count = options.count;
        }
        if (this.options.interpolation.defaultVariables) {
          data = {
            ...this.options.interpolation.defaultVariables,
            ...data
          };
        }
        if (!useOptionsReplaceForData) {
          data = {
            ...data
          };
          for (const key of optionsKeys) {
            delete data[key];
          }
        }
        return data;
      }
      static hasDefaultValue(options) {
        const prefix = "defaultValue";
        for (const option in options) {
          if (Object.prototype.hasOwnProperty.call(options, option) && prefix === option.substring(0, prefix.length) && void 0 !== options[option]) {
            return true;
          }
        }
        return false;
      }
    };
    capitalize = (string) => string.charAt(0).toUpperCase() + string.slice(1);
    LanguageUtil = class {
      constructor(options) {
        this.options = options;
        this.supportedLngs = this.options.supportedLngs || false;
        this.logger = baseLogger.create("languageUtils");
      }
      getScriptPartFromCode(code) {
        code = getCleanedCode(code);
        if (!code || code.indexOf("-") < 0) return null;
        const p = code.split("-");
        if (p.length === 2) return null;
        p.pop();
        if (p[p.length - 1].toLowerCase() === "x") return null;
        return this.formatLanguageCode(p.join("-"));
      }
      getLanguagePartFromCode(code) {
        code = getCleanedCode(code);
        if (!code || code.indexOf("-") < 0) return code;
        const p = code.split("-");
        return this.formatLanguageCode(p[0]);
      }
      formatLanguageCode(code) {
        if (isString(code) && code.indexOf("-") > -1) {
          if (typeof Intl !== "undefined" && typeof Intl.getCanonicalLocales !== "undefined") {
            try {
              let formattedCode = Intl.getCanonicalLocales(code)[0];
              if (formattedCode && this.options.lowerCaseLng) {
                formattedCode = formattedCode.toLowerCase();
              }
              if (formattedCode) return formattedCode;
            } catch (e) {
            }
          }
          const specialCases = ["hans", "hant", "latn", "cyrl", "cans", "mong", "arab"];
          let p = code.split("-");
          if (this.options.lowerCaseLng) {
            p = p.map((part) => part.toLowerCase());
          } else if (p.length === 2) {
            p[0] = p[0].toLowerCase();
            p[1] = p[1].toUpperCase();
            if (specialCases.indexOf(p[1].toLowerCase()) > -1) p[1] = capitalize(p[1].toLowerCase());
          } else if (p.length === 3) {
            p[0] = p[0].toLowerCase();
            if (p[1].length === 2) p[1] = p[1].toUpperCase();
            if (p[0] !== "sgn" && p[2].length === 2) p[2] = p[2].toUpperCase();
            if (specialCases.indexOf(p[1].toLowerCase()) > -1) p[1] = capitalize(p[1].toLowerCase());
            if (specialCases.indexOf(p[2].toLowerCase()) > -1) p[2] = capitalize(p[2].toLowerCase());
          }
          return p.join("-");
        }
        return this.options.cleanCode || this.options.lowerCaseLng ? code.toLowerCase() : code;
      }
      isSupportedCode(code) {
        if (this.options.load === "languageOnly" || this.options.nonExplicitSupportedLngs) {
          code = this.getLanguagePartFromCode(code);
        }
        return !this.supportedLngs || !this.supportedLngs.length || this.supportedLngs.indexOf(code) > -1;
      }
      getBestMatchFromCodes(codes) {
        if (!codes) return null;
        let found;
        codes.forEach((code) => {
          if (found) return;
          const cleanedLng = this.formatLanguageCode(code);
          if (!this.options.supportedLngs || this.isSupportedCode(cleanedLng)) found = cleanedLng;
        });
        if (!found && this.options.supportedLngs) {
          codes.forEach((code) => {
            if (found) return;
            const lngOnly = this.getLanguagePartFromCode(code);
            if (this.isSupportedCode(lngOnly)) return found = lngOnly;
            found = this.options.supportedLngs.find((supportedLng) => {
              if (supportedLng === lngOnly) return supportedLng;
              if (supportedLng.indexOf("-") < 0 && lngOnly.indexOf("-") < 0) return;
              if (supportedLng.indexOf("-") > 0 && lngOnly.indexOf("-") < 0 && supportedLng.substring(0, supportedLng.indexOf("-")) === lngOnly) return supportedLng;
              if (supportedLng.indexOf(lngOnly) === 0 && lngOnly.length > 1) return supportedLng;
            });
          });
        }
        if (!found) found = this.getFallbackCodes(this.options.fallbackLng)[0];
        return found;
      }
      getFallbackCodes(fallbacks, code) {
        if (!fallbacks) return [];
        if (typeof fallbacks === "function") fallbacks = fallbacks(code);
        if (isString(fallbacks)) fallbacks = [fallbacks];
        if (Array.isArray(fallbacks)) return fallbacks;
        if (!code) return fallbacks.default || [];
        let found = fallbacks[code];
        if (!found) found = fallbacks[this.getScriptPartFromCode(code)];
        if (!found) found = fallbacks[this.formatLanguageCode(code)];
        if (!found) found = fallbacks[this.getLanguagePartFromCode(code)];
        if (!found) found = fallbacks.default;
        return found || [];
      }
      toResolveHierarchy(code, fallbackCode) {
        const fallbackCodes = this.getFallbackCodes(fallbackCode || this.options.fallbackLng || [], code);
        const codes = [];
        const addCode = (c) => {
          if (!c) return;
          if (this.isSupportedCode(c)) {
            codes.push(c);
          } else {
            this.logger.warn(`rejecting language code not found in supportedLngs: ${c}`);
          }
        };
        if (isString(code) && (code.indexOf("-") > -1 || code.indexOf("_") > -1)) {
          if (this.options.load !== "languageOnly") addCode(this.formatLanguageCode(code));
          if (this.options.load !== "languageOnly" && this.options.load !== "currentOnly") addCode(this.getScriptPartFromCode(code));
          if (this.options.load !== "currentOnly") addCode(this.getLanguagePartFromCode(code));
        } else if (isString(code)) {
          addCode(this.formatLanguageCode(code));
        }
        fallbackCodes.forEach((fc) => {
          if (codes.indexOf(fc) < 0) addCode(this.formatLanguageCode(fc));
        });
        return codes;
      }
    };
    sets = [{
      lngs: ["ach", "ak", "am", "arn", "br", "fil", "gun", "ln", "mfe", "mg", "mi", "oc", "pt", "pt-BR", "tg", "tl", "ti", "tr", "uz", "wa"],
      nr: [1, 2],
      fc: 1
    }, {
      lngs: ["af", "an", "ast", "az", "bg", "bn", "ca", "da", "de", "dev", "el", "en", "eo", "es", "et", "eu", "fi", "fo", "fur", "fy", "gl", "gu", "ha", "hi", "hu", "hy", "ia", "it", "kk", "kn", "ku", "lb", "mai", "ml", "mn", "mr", "nah", "nap", "nb", "ne", "nl", "nn", "no", "nso", "pa", "pap", "pms", "ps", "pt-PT", "rm", "sco", "se", "si", "so", "son", "sq", "sv", "sw", "ta", "te", "tk", "ur", "yo"],
      nr: [1, 2],
      fc: 2
    }, {
      lngs: ["ay", "bo", "cgg", "fa", "ht", "id", "ja", "jbo", "ka", "km", "ko", "ky", "lo", "ms", "sah", "su", "th", "tt", "ug", "vi", "wo", "zh"],
      nr: [1],
      fc: 3
    }, {
      lngs: ["be", "bs", "cnr", "dz", "hr", "ru", "sr", "uk"],
      nr: [1, 2, 5],
      fc: 4
    }, {
      lngs: ["ar"],
      nr: [0, 1, 2, 3, 11, 100],
      fc: 5
    }, {
      lngs: ["cs", "sk"],
      nr: [1, 2, 5],
      fc: 6
    }, {
      lngs: ["csb", "pl"],
      nr: [1, 2, 5],
      fc: 7
    }, {
      lngs: ["cy"],
      nr: [1, 2, 3, 8],
      fc: 8
    }, {
      lngs: ["fr"],
      nr: [1, 2],
      fc: 9
    }, {
      lngs: ["ga"],
      nr: [1, 2, 3, 7, 11],
      fc: 10
    }, {
      lngs: ["gd"],
      nr: [1, 2, 3, 20],
      fc: 11
    }, {
      lngs: ["is"],
      nr: [1, 2],
      fc: 12
    }, {
      lngs: ["jv"],
      nr: [0, 1],
      fc: 13
    }, {
      lngs: ["kw"],
      nr: [1, 2, 3, 4],
      fc: 14
    }, {
      lngs: ["lt"],
      nr: [1, 2, 10],
      fc: 15
    }, {
      lngs: ["lv"],
      nr: [1, 2, 0],
      fc: 16
    }, {
      lngs: ["mk"],
      nr: [1, 2],
      fc: 17
    }, {
      lngs: ["mnk"],
      nr: [0, 1, 2],
      fc: 18
    }, {
      lngs: ["mt"],
      nr: [1, 2, 11, 20],
      fc: 19
    }, {
      lngs: ["or"],
      nr: [2, 1],
      fc: 2
    }, {
      lngs: ["ro"],
      nr: [1, 2, 20],
      fc: 20
    }, {
      lngs: ["sl"],
      nr: [5, 1, 2, 3],
      fc: 21
    }, {
      lngs: ["he", "iw"],
      nr: [1, 2, 20, 21],
      fc: 22
    }];
    _rulesPluralsTypes = {
      1: (n) => Number(n > 1),
      2: (n) => Number(n != 1),
      3: (n) => 0,
      4: (n) => Number(n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2),
      5: (n) => Number(n == 0 ? 0 : n == 1 ? 1 : n == 2 ? 2 : n % 100 >= 3 && n % 100 <= 10 ? 3 : n % 100 >= 11 ? 4 : 5),
      6: (n) => Number(n == 1 ? 0 : n >= 2 && n <= 4 ? 1 : 2),
      7: (n) => Number(n == 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2),
      8: (n) => Number(n == 1 ? 0 : n == 2 ? 1 : n != 8 && n != 11 ? 2 : 3),
      9: (n) => Number(n >= 2),
      10: (n) => Number(n == 1 ? 0 : n == 2 ? 1 : n < 7 ? 2 : n < 11 ? 3 : 4),
      11: (n) => Number(n == 1 || n == 11 ? 0 : n == 2 || n == 12 ? 1 : n > 2 && n < 20 ? 2 : 3),
      12: (n) => Number(n % 10 != 1 || n % 100 == 11),
      13: (n) => Number(n !== 0),
      14: (n) => Number(n == 1 ? 0 : n == 2 ? 1 : n == 3 ? 2 : 3),
      15: (n) => Number(n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2),
      16: (n) => Number(n % 10 == 1 && n % 100 != 11 ? 0 : n !== 0 ? 1 : 2),
      17: (n) => Number(n == 1 || n % 10 == 1 && n % 100 != 11 ? 0 : 1),
      18: (n) => Number(n == 0 ? 0 : n == 1 ? 1 : 2),
      19: (n) => Number(n == 1 ? 0 : n == 0 || n % 100 > 1 && n % 100 < 11 ? 1 : n % 100 > 10 && n % 100 < 20 ? 2 : 3),
      20: (n) => Number(n == 1 ? 0 : n == 0 || n % 100 > 0 && n % 100 < 20 ? 1 : 2),
      21: (n) => Number(n % 100 == 1 ? 1 : n % 100 == 2 ? 2 : n % 100 == 3 || n % 100 == 4 ? 3 : 0),
      22: (n) => Number(n == 1 ? 0 : n == 2 ? 1 : (n < 0 || n > 10) && n % 10 == 0 ? 2 : 3)
    };
    nonIntlVersions = ["v1", "v2", "v3"];
    intlVersions = ["v4"];
    suffixesOrder = {
      zero: 0,
      one: 1,
      two: 2,
      few: 3,
      many: 4,
      other: 5
    };
    createRules = () => {
      const rules = {};
      sets.forEach((set) => {
        set.lngs.forEach((l) => {
          rules[l] = {
            numbers: set.nr,
            plurals: _rulesPluralsTypes[set.fc]
          };
        });
      });
      return rules;
    };
    PluralResolver = class {
      constructor(languageUtils) {
        let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        this.languageUtils = languageUtils;
        this.options = options;
        this.logger = baseLogger.create("pluralResolver");
        if ((!this.options.compatibilityJSON || intlVersions.includes(this.options.compatibilityJSON)) && (typeof Intl === "undefined" || !Intl.PluralRules)) {
          this.options.compatibilityJSON = "v3";
          this.logger.error("Your environment seems not to be Intl API compatible, use an Intl.PluralRules polyfill. Will fallback to the compatibilityJSON v3 format handling.");
        }
        this.rules = createRules();
        this.pluralRulesCache = {};
      }
      addRule(lng, obj) {
        this.rules[lng] = obj;
      }
      clearCache() {
        this.pluralRulesCache = {};
      }
      getRule(code) {
        let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        if (this.shouldUseIntlApi()) {
          const cleanedCode = getCleanedCode(code === "dev" ? "en" : code);
          const type = options.ordinal ? "ordinal" : "cardinal";
          const cacheKey = JSON.stringify({
            cleanedCode,
            type
          });
          if (cacheKey in this.pluralRulesCache) {
            return this.pluralRulesCache[cacheKey];
          }
          let rule;
          try {
            rule = new Intl.PluralRules(cleanedCode, {
              type
            });
          } catch (err) {
            if (!code.match(/-|_/)) return;
            const lngPart = this.languageUtils.getLanguagePartFromCode(code);
            rule = this.getRule(lngPart, options);
          }
          this.pluralRulesCache[cacheKey] = rule;
          return rule;
        }
        return this.rules[code] || this.rules[this.languageUtils.getLanguagePartFromCode(code)];
      }
      needsPlural(code) {
        let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        const rule = this.getRule(code, options);
        if (this.shouldUseIntlApi()) {
          return rule && rule.resolvedOptions().pluralCategories.length > 1;
        }
        return rule && rule.numbers.length > 1;
      }
      getPluralFormsOfKey(code, key) {
        let options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
        return this.getSuffixes(code, options).map((suffix) => `${key}${suffix}`);
      }
      getSuffixes(code) {
        let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        const rule = this.getRule(code, options);
        if (!rule) {
          return [];
        }
        if (this.shouldUseIntlApi()) {
          return rule.resolvedOptions().pluralCategories.sort((pluralCategory1, pluralCategory2) => suffixesOrder[pluralCategory1] - suffixesOrder[pluralCategory2]).map((pluralCategory) => `${this.options.prepend}${options.ordinal ? `ordinal${this.options.prepend}` : ""}${pluralCategory}`);
        }
        return rule.numbers.map((number) => this.getSuffix(code, number, options));
      }
      getSuffix(code, count) {
        let options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
        const rule = this.getRule(code, options);
        if (rule) {
          if (this.shouldUseIntlApi()) {
            return `${this.options.prepend}${options.ordinal ? `ordinal${this.options.prepend}` : ""}${rule.select(count)}`;
          }
          return this.getSuffixRetroCompatible(rule, count);
        }
        this.logger.warn(`no plural rule found for: ${code}`);
        return "";
      }
      getSuffixRetroCompatible(rule, count) {
        const idx = rule.noAbs ? rule.plurals(count) : rule.plurals(Math.abs(count));
        let suffix = rule.numbers[idx];
        if (this.options.simplifyPluralSuffix && rule.numbers.length === 2 && rule.numbers[0] === 1) {
          if (suffix === 2) {
            suffix = "plural";
          } else if (suffix === 1) {
            suffix = "";
          }
        }
        const returnSuffix = () => this.options.prepend && suffix.toString() ? this.options.prepend + suffix.toString() : suffix.toString();
        if (this.options.compatibilityJSON === "v1") {
          if (suffix === 1) return "";
          if (typeof suffix === "number") return `_plural_${suffix.toString()}`;
          return returnSuffix();
        } else if (this.options.compatibilityJSON === "v2") {
          return returnSuffix();
        } else if (this.options.simplifyPluralSuffix && rule.numbers.length === 2 && rule.numbers[0] === 1) {
          return returnSuffix();
        }
        return this.options.prepend && idx.toString() ? this.options.prepend + idx.toString() : idx.toString();
      }
      shouldUseIntlApi() {
        return !nonIntlVersions.includes(this.options.compatibilityJSON);
      }
    };
    deepFindWithDefaults = function(data, defaultData, key) {
      let keySeparator = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : ".";
      let ignoreJSONStructure = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : true;
      let path = getPathWithDefaults(data, defaultData, key);
      if (!path && ignoreJSONStructure && isString(key)) {
        path = deepFind(data, key, keySeparator);
        if (path === void 0) path = deepFind(defaultData, key, keySeparator);
      }
      return path;
    };
    regexSafe = (val) => val.replace(/\$/g, "$$$$");
    Interpolator = class {
      constructor() {
        let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        this.logger = baseLogger.create("interpolator");
        this.options = options;
        this.format = options.interpolation && options.interpolation.format || ((value) => value);
        this.init(options);
      }
      init() {
        let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        if (!options.interpolation) options.interpolation = {
          escapeValue: true
        };
        const {
          escape: escape$1,
          escapeValue,
          useRawValueToEscape,
          prefix,
          prefixEscaped,
          suffix,
          suffixEscaped,
          formatSeparator,
          unescapeSuffix,
          unescapePrefix,
          nestingPrefix,
          nestingPrefixEscaped,
          nestingSuffix,
          nestingSuffixEscaped,
          nestingOptionsSeparator,
          maxReplaces,
          alwaysFormat
        } = options.interpolation;
        this.escape = escape$1 !== void 0 ? escape$1 : escape;
        this.escapeValue = escapeValue !== void 0 ? escapeValue : true;
        this.useRawValueToEscape = useRawValueToEscape !== void 0 ? useRawValueToEscape : false;
        this.prefix = prefix ? regexEscape(prefix) : prefixEscaped || "{{";
        this.suffix = suffix ? regexEscape(suffix) : suffixEscaped || "}}";
        this.formatSeparator = formatSeparator || ",";
        this.unescapePrefix = unescapeSuffix ? "" : unescapePrefix || "-";
        this.unescapeSuffix = this.unescapePrefix ? "" : unescapeSuffix || "";
        this.nestingPrefix = nestingPrefix ? regexEscape(nestingPrefix) : nestingPrefixEscaped || regexEscape("$t(");
        this.nestingSuffix = nestingSuffix ? regexEscape(nestingSuffix) : nestingSuffixEscaped || regexEscape(")");
        this.nestingOptionsSeparator = nestingOptionsSeparator || ",";
        this.maxReplaces = maxReplaces || 1e3;
        this.alwaysFormat = alwaysFormat !== void 0 ? alwaysFormat : false;
        this.resetRegExp();
      }
      reset() {
        if (this.options) this.init(this.options);
      }
      resetRegExp() {
        const getOrResetRegExp = (existingRegExp, pattern) => {
          if (existingRegExp && existingRegExp.source === pattern) {
            existingRegExp.lastIndex = 0;
            return existingRegExp;
          }
          return new RegExp(pattern, "g");
        };
        this.regexp = getOrResetRegExp(this.regexp, `${this.prefix}(.+?)${this.suffix}`);
        this.regexpUnescape = getOrResetRegExp(this.regexpUnescape, `${this.prefix}${this.unescapePrefix}(.+?)${this.unescapeSuffix}${this.suffix}`);
        this.nestingRegexp = getOrResetRegExp(this.nestingRegexp, `${this.nestingPrefix}(.+?)${this.nestingSuffix}`);
      }
      interpolate(str, data, lng, options) {
        let match;
        let value;
        let replaces;
        const defaultData = this.options && this.options.interpolation && this.options.interpolation.defaultVariables || {};
        const handleFormat = (key) => {
          if (key.indexOf(this.formatSeparator) < 0) {
            const path = deepFindWithDefaults(data, defaultData, key, this.options.keySeparator, this.options.ignoreJSONStructure);
            return this.alwaysFormat ? this.format(path, void 0, lng, {
              ...options,
              ...data,
              interpolationkey: key
            }) : path;
          }
          const p = key.split(this.formatSeparator);
          const k = p.shift().trim();
          const f = p.join(this.formatSeparator).trim();
          return this.format(deepFindWithDefaults(data, defaultData, k, this.options.keySeparator, this.options.ignoreJSONStructure), f, lng, {
            ...options,
            ...data,
            interpolationkey: k
          });
        };
        this.resetRegExp();
        const missingInterpolationHandler = options && options.missingInterpolationHandler || this.options.missingInterpolationHandler;
        const skipOnVariables = options && options.interpolation && options.interpolation.skipOnVariables !== void 0 ? options.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables;
        const todos = [{
          regex: this.regexpUnescape,
          safeValue: (val) => regexSafe(val)
        }, {
          regex: this.regexp,
          safeValue: (val) => this.escapeValue ? regexSafe(this.escape(val)) : regexSafe(val)
        }];
        todos.forEach((todo) => {
          replaces = 0;
          while (match = todo.regex.exec(str)) {
            const matchedVar = match[1].trim();
            value = handleFormat(matchedVar);
            if (value === void 0) {
              if (typeof missingInterpolationHandler === "function") {
                const temp = missingInterpolationHandler(str, match, options);
                value = isString(temp) ? temp : "";
              } else if (options && Object.prototype.hasOwnProperty.call(options, matchedVar)) {
                value = "";
              } else if (skipOnVariables) {
                value = match[0];
                continue;
              } else {
                this.logger.warn(`missed to pass in variable ${matchedVar} for interpolating ${str}`);
                value = "";
              }
            } else if (!isString(value) && !this.useRawValueToEscape) {
              value = makeString(value);
            }
            const safeValue = todo.safeValue(value);
            str = str.replace(match[0], safeValue);
            if (skipOnVariables) {
              todo.regex.lastIndex += value.length;
              todo.regex.lastIndex -= match[0].length;
            } else {
              todo.regex.lastIndex = 0;
            }
            replaces++;
            if (replaces >= this.maxReplaces) {
              break;
            }
          }
        });
        return str;
      }
      nest(str, fc) {
        let options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
        let match;
        let value;
        let clonedOptions;
        const handleHasOptions = (key, inheritedOptions) => {
          const sep = this.nestingOptionsSeparator;
          if (key.indexOf(sep) < 0) return key;
          const c = key.split(new RegExp(`${sep}[ ]*{`));
          let optionsString = `{${c[1]}`;
          key = c[0];
          optionsString = this.interpolate(optionsString, clonedOptions);
          const matchedSingleQuotes = optionsString.match(/'/g);
          const matchedDoubleQuotes = optionsString.match(/"/g);
          if (matchedSingleQuotes && matchedSingleQuotes.length % 2 === 0 && !matchedDoubleQuotes || matchedDoubleQuotes.length % 2 !== 0) {
            optionsString = optionsString.replace(/'/g, '"');
          }
          try {
            clonedOptions = JSON.parse(optionsString);
            if (inheritedOptions) clonedOptions = {
              ...inheritedOptions,
              ...clonedOptions
            };
          } catch (e) {
            this.logger.warn(`failed parsing options string in nesting for key ${key}`, e);
            return `${key}${sep}${optionsString}`;
          }
          if (clonedOptions.defaultValue && clonedOptions.defaultValue.indexOf(this.prefix) > -1) delete clonedOptions.defaultValue;
          return key;
        };
        while (match = this.nestingRegexp.exec(str)) {
          let formatters = [];
          clonedOptions = {
            ...options
          };
          clonedOptions = clonedOptions.replace && !isString(clonedOptions.replace) ? clonedOptions.replace : clonedOptions;
          clonedOptions.applyPostProcessor = false;
          delete clonedOptions.defaultValue;
          let doReduce = false;
          if (match[0].indexOf(this.formatSeparator) !== -1 && !/{.*}/.test(match[1])) {
            const r = match[1].split(this.formatSeparator).map((elem) => elem.trim());
            match[1] = r.shift();
            formatters = r;
            doReduce = true;
          }
          value = fc(handleHasOptions.call(this, match[1].trim(), clonedOptions), clonedOptions);
          if (value && match[0] === str && !isString(value)) return value;
          if (!isString(value)) value = makeString(value);
          if (!value) {
            this.logger.warn(`missed to resolve ${match[1]} for nesting ${str}`);
            value = "";
          }
          if (doReduce) {
            value = formatters.reduce((v, f) => this.format(v, f, options.lng, {
              ...options,
              interpolationkey: match[1].trim()
            }), value.trim());
          }
          str = str.replace(match[0], value);
          this.regexp.lastIndex = 0;
        }
        return str;
      }
    };
    parseFormatStr = (formatStr) => {
      let formatName = formatStr.toLowerCase().trim();
      const formatOptions = {};
      if (formatStr.indexOf("(") > -1) {
        const p = formatStr.split("(");
        formatName = p[0].toLowerCase().trim();
        const optStr = p[1].substring(0, p[1].length - 1);
        if (formatName === "currency" && optStr.indexOf(":") < 0) {
          if (!formatOptions.currency) formatOptions.currency = optStr.trim();
        } else if (formatName === "relativetime" && optStr.indexOf(":") < 0) {
          if (!formatOptions.range) formatOptions.range = optStr.trim();
        } else {
          const opts = optStr.split(";");
          opts.forEach((opt) => {
            if (opt) {
              const [key, ...rest] = opt.split(":");
              const val = rest.join(":").trim().replace(/^'+|'+$/g, "");
              const trimmedKey = key.trim();
              if (!formatOptions[trimmedKey]) formatOptions[trimmedKey] = val;
              if (val === "false") formatOptions[trimmedKey] = false;
              if (val === "true") formatOptions[trimmedKey] = true;
              if (!isNaN(val)) formatOptions[trimmedKey] = parseInt(val, 10);
            }
          });
        }
      }
      return {
        formatName,
        formatOptions
      };
    };
    createCachedFormatter = (fn) => {
      const cache = {};
      return (val, lng, options) => {
        let optForCache = options;
        if (options && options.interpolationkey && options.formatParams && options.formatParams[options.interpolationkey] && options[options.interpolationkey]) {
          optForCache = {
            ...optForCache,
            [options.interpolationkey]: void 0
          };
        }
        const key = lng + JSON.stringify(optForCache);
        let formatter = cache[key];
        if (!formatter) {
          formatter = fn(getCleanedCode(lng), options);
          cache[key] = formatter;
        }
        return formatter(val);
      };
    };
    Formatter = class {
      constructor() {
        let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        this.logger = baseLogger.create("formatter");
        this.options = options;
        this.formats = {
          number: createCachedFormatter((lng, opt) => {
            const formatter = new Intl.NumberFormat(lng, {
              ...opt
            });
            return (val) => formatter.format(val);
          }),
          currency: createCachedFormatter((lng, opt) => {
            const formatter = new Intl.NumberFormat(lng, {
              ...opt,
              style: "currency"
            });
            return (val) => formatter.format(val);
          }),
          datetime: createCachedFormatter((lng, opt) => {
            const formatter = new Intl.DateTimeFormat(lng, {
              ...opt
            });
            return (val) => formatter.format(val);
          }),
          relativetime: createCachedFormatter((lng, opt) => {
            const formatter = new Intl.RelativeTimeFormat(lng, {
              ...opt
            });
            return (val) => formatter.format(val, opt.range || "day");
          }),
          list: createCachedFormatter((lng, opt) => {
            const formatter = new Intl.ListFormat(lng, {
              ...opt
            });
            return (val) => formatter.format(val);
          })
        };
        this.init(options);
      }
      init(services) {
        let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {
          interpolation: {}
        };
        this.formatSeparator = options.interpolation.formatSeparator || ",";
      }
      add(name, fc) {
        this.formats[name.toLowerCase().trim()] = fc;
      }
      addCached(name, fc) {
        this.formats[name.toLowerCase().trim()] = createCachedFormatter(fc);
      }
      format(value, format, lng) {
        let options = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {};
        const formats = format.split(this.formatSeparator);
        if (formats.length > 1 && formats[0].indexOf("(") > 1 && formats[0].indexOf(")") < 0 && formats.find((f) => f.indexOf(")") > -1)) {
          const lastIndex = formats.findIndex((f) => f.indexOf(")") > -1);
          formats[0] = [formats[0], ...formats.splice(1, lastIndex)].join(this.formatSeparator);
        }
        const result = formats.reduce((mem, f) => {
          const {
            formatName,
            formatOptions
          } = parseFormatStr(f);
          if (this.formats[formatName]) {
            let formatted = mem;
            try {
              const valOptions = options && options.formatParams && options.formatParams[options.interpolationkey] || {};
              const l = valOptions.locale || valOptions.lng || options.locale || options.lng || lng;
              formatted = this.formats[formatName](mem, l, {
                ...formatOptions,
                ...options,
                ...valOptions
              });
            } catch (error) {
              this.logger.warn(error);
            }
            return formatted;
          } else {
            this.logger.warn(`there was no format function for ${formatName}`);
          }
          return mem;
        }, value);
        return result;
      }
    };
    removePending = (q, name) => {
      if (q.pending[name] !== void 0) {
        delete q.pending[name];
        q.pendingCount--;
      }
    };
    Connector = class extends EventEmitter {
      constructor(backend, store, services) {
        let options = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {};
        super();
        this.backend = backend;
        this.store = store;
        this.services = services;
        this.languageUtils = services.languageUtils;
        this.options = options;
        this.logger = baseLogger.create("backendConnector");
        this.waitingReads = [];
        this.maxParallelReads = options.maxParallelReads || 10;
        this.readingCalls = 0;
        this.maxRetries = options.maxRetries >= 0 ? options.maxRetries : 5;
        this.retryTimeout = options.retryTimeout >= 1 ? options.retryTimeout : 350;
        this.state = {};
        this.queue = [];
        if (this.backend && this.backend.init) {
          this.backend.init(services, options.backend, options);
        }
      }
      queueLoad(languages, namespaces, options, callback) {
        const toLoad = {};
        const pending = {};
        const toLoadLanguages = {};
        const toLoadNamespaces = {};
        languages.forEach((lng) => {
          let hasAllNamespaces = true;
          namespaces.forEach((ns) => {
            const name = `${lng}|${ns}`;
            if (!options.reload && this.store.hasResourceBundle(lng, ns)) {
              this.state[name] = 2;
            } else if (this.state[name] < 0) ;
            else if (this.state[name] === 1) {
              if (pending[name] === void 0) pending[name] = true;
            } else {
              this.state[name] = 1;
              hasAllNamespaces = false;
              if (pending[name] === void 0) pending[name] = true;
              if (toLoad[name] === void 0) toLoad[name] = true;
              if (toLoadNamespaces[ns] === void 0) toLoadNamespaces[ns] = true;
            }
          });
          if (!hasAllNamespaces) toLoadLanguages[lng] = true;
        });
        if (Object.keys(toLoad).length || Object.keys(pending).length) {
          this.queue.push({
            pending,
            pendingCount: Object.keys(pending).length,
            loaded: {},
            errors: [],
            callback
          });
        }
        return {
          toLoad: Object.keys(toLoad),
          pending: Object.keys(pending),
          toLoadLanguages: Object.keys(toLoadLanguages),
          toLoadNamespaces: Object.keys(toLoadNamespaces)
        };
      }
      loaded(name, err, data) {
        const s = name.split("|");
        const lng = s[0];
        const ns = s[1];
        if (err) this.emit("failedLoading", lng, ns, err);
        if (!err && data) {
          this.store.addResourceBundle(lng, ns, data, void 0, void 0, {
            skipCopy: true
          });
        }
        this.state[name] = err ? -1 : 2;
        if (err && data) this.state[name] = 0;
        const loaded = {};
        this.queue.forEach((q) => {
          pushPath(q.loaded, [lng], ns);
          removePending(q, name);
          if (err) q.errors.push(err);
          if (q.pendingCount === 0 && !q.done) {
            Object.keys(q.loaded).forEach((l) => {
              if (!loaded[l]) loaded[l] = {};
              const loadedKeys = q.loaded[l];
              if (loadedKeys.length) {
                loadedKeys.forEach((n) => {
                  if (loaded[l][n] === void 0) loaded[l][n] = true;
                });
              }
            });
            q.done = true;
            if (q.errors.length) {
              q.callback(q.errors);
            } else {
              q.callback();
            }
          }
        });
        this.emit("loaded", loaded);
        this.queue = this.queue.filter((q) => !q.done);
      }
      read(lng, ns, fcName) {
        let tried = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 0;
        let wait = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : this.retryTimeout;
        let callback = arguments.length > 5 ? arguments[5] : void 0;
        if (!lng.length) return callback(null, {});
        if (this.readingCalls >= this.maxParallelReads) {
          this.waitingReads.push({
            lng,
            ns,
            fcName,
            tried,
            wait,
            callback
          });
          return;
        }
        this.readingCalls++;
        const resolver = (err, data) => {
          this.readingCalls--;
          if (this.waitingReads.length > 0) {
            const next = this.waitingReads.shift();
            this.read(next.lng, next.ns, next.fcName, next.tried, next.wait, next.callback);
          }
          if (err && data && tried < this.maxRetries) {
            setTimeout(() => {
              this.read.call(this, lng, ns, fcName, tried + 1, wait * 2, callback);
            }, wait);
            return;
          }
          callback(err, data);
        };
        const fc = this.backend[fcName].bind(this.backend);
        if (fc.length === 2) {
          try {
            const r = fc(lng, ns);
            if (r && typeof r.then === "function") {
              r.then((data) => resolver(null, data)).catch(resolver);
            } else {
              resolver(null, r);
            }
          } catch (err) {
            resolver(err);
          }
          return;
        }
        return fc(lng, ns, resolver);
      }
      prepareLoading(languages, namespaces) {
        let options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
        let callback = arguments.length > 3 ? arguments[3] : void 0;
        if (!this.backend) {
          this.logger.warn("No backend was added via i18next.use. Will not load resources.");
          return callback && callback();
        }
        if (isString(languages)) languages = this.languageUtils.toResolveHierarchy(languages);
        if (isString(namespaces)) namespaces = [namespaces];
        const toLoad = this.queueLoad(languages, namespaces, options, callback);
        if (!toLoad.toLoad.length) {
          if (!toLoad.pending.length) callback();
          return null;
        }
        toLoad.toLoad.forEach((name) => {
          this.loadOne(name);
        });
      }
      load(languages, namespaces, callback) {
        this.prepareLoading(languages, namespaces, {}, callback);
      }
      reload(languages, namespaces, callback) {
        this.prepareLoading(languages, namespaces, {
          reload: true
        }, callback);
      }
      loadOne(name) {
        let prefix = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "";
        const s = name.split("|");
        const lng = s[0];
        const ns = s[1];
        this.read(lng, ns, "read", void 0, void 0, (err, data) => {
          if (err) this.logger.warn(`${prefix}loading namespace ${ns} for language ${lng} failed`, err);
          if (!err && data) this.logger.log(`${prefix}loaded namespace ${ns} for language ${lng}`, data);
          this.loaded(name, err, data);
        });
      }
      saveMissing(languages, namespace, key, fallbackValue, isUpdate) {
        let options = arguments.length > 5 && arguments[5] !== void 0 ? arguments[5] : {};
        let clb = arguments.length > 6 && arguments[6] !== void 0 ? arguments[6] : () => {
        };
        if (this.services.utils && this.services.utils.hasLoadedNamespace && !this.services.utils.hasLoadedNamespace(namespace)) {
          this.logger.warn(`did not save key "${key}" as the namespace "${namespace}" was not yet loaded`, "This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!");
          return;
        }
        if (key === void 0 || key === null || key === "") return;
        if (this.backend && this.backend.create) {
          const opts = {
            ...options,
            isUpdate
          };
          const fc = this.backend.create.bind(this.backend);
          if (fc.length < 6) {
            try {
              let r;
              if (fc.length === 5) {
                r = fc(languages, namespace, key, fallbackValue, opts);
              } else {
                r = fc(languages, namespace, key, fallbackValue);
              }
              if (r && typeof r.then === "function") {
                r.then((data) => clb(null, data)).catch(clb);
              } else {
                clb(null, r);
              }
            } catch (err) {
              clb(err);
            }
          } else {
            fc(languages, namespace, key, fallbackValue, clb, opts);
          }
        }
        if (!languages || !languages[0]) return;
        this.store.addResource(languages[0], namespace, key, fallbackValue);
      }
    };
    get = () => ({
      debug: false,
      initImmediate: true,
      ns: ["translation"],
      defaultNS: ["translation"],
      fallbackLng: ["dev"],
      fallbackNS: false,
      supportedLngs: false,
      nonExplicitSupportedLngs: false,
      load: "all",
      preload: false,
      simplifyPluralSuffix: true,
      keySeparator: ".",
      nsSeparator: ":",
      pluralSeparator: "_",
      contextSeparator: "_",
      partialBundledLanguages: false,
      saveMissing: false,
      updateMissing: false,
      saveMissingTo: "fallback",
      saveMissingPlurals: true,
      missingKeyHandler: false,
      missingInterpolationHandler: false,
      postProcess: false,
      postProcessPassResolved: false,
      returnNull: false,
      returnEmptyString: true,
      returnObjects: false,
      joinArrays: false,
      returnedObjectHandler: false,
      parseMissingKeyHandler: false,
      appendNamespaceToMissingKey: false,
      appendNamespaceToCIMode: false,
      overloadTranslationOptionHandler: (args) => {
        let ret = {};
        if (typeof args[1] === "object") ret = args[1];
        if (isString(args[1])) ret.defaultValue = args[1];
        if (isString(args[2])) ret.tDescription = args[2];
        if (typeof args[2] === "object" || typeof args[3] === "object") {
          const options = args[3] || args[2];
          Object.keys(options).forEach((key) => {
            ret[key] = options[key];
          });
        }
        return ret;
      },
      interpolation: {
        escapeValue: true,
        format: (value) => value,
        prefix: "{{",
        suffix: "}}",
        formatSeparator: ",",
        unescapePrefix: "-",
        nestingPrefix: "$t(",
        nestingSuffix: ")",
        nestingOptionsSeparator: ",",
        maxReplaces: 1e3,
        skipOnVariables: true
      }
    });
    transformOptions = (options) => {
      if (isString(options.ns)) options.ns = [options.ns];
      if (isString(options.fallbackLng)) options.fallbackLng = [options.fallbackLng];
      if (isString(options.fallbackNS)) options.fallbackNS = [options.fallbackNS];
      if (options.supportedLngs && options.supportedLngs.indexOf("cimode") < 0) {
        options.supportedLngs = options.supportedLngs.concat(["cimode"]);
      }
      return options;
    };
    noop = () => {
    };
    bindMemberFunctions = (inst) => {
      const mems = Object.getOwnPropertyNames(Object.getPrototypeOf(inst));
      mems.forEach((mem) => {
        if (typeof inst[mem] === "function") {
          inst[mem] = inst[mem].bind(inst);
        }
      });
    };
    I18n = class _I18n extends EventEmitter {
      constructor() {
        let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        let callback = arguments.length > 1 ? arguments[1] : void 0;
        super();
        this.options = transformOptions(options);
        this.services = {};
        this.logger = baseLogger;
        this.modules = {
          external: []
        };
        bindMemberFunctions(this);
        if (callback && !this.isInitialized && !options.isClone) {
          if (!this.options.initImmediate) {
            this.init(options, callback);
            return this;
          }
          setTimeout(() => {
            this.init(options, callback);
          }, 0);
        }
      }
      init() {
        var _this = this;
        let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        let callback = arguments.length > 1 ? arguments[1] : void 0;
        this.isInitializing = true;
        if (typeof options === "function") {
          callback = options;
          options = {};
        }
        if (!options.defaultNS && options.defaultNS !== false && options.ns) {
          if (isString(options.ns)) {
            options.defaultNS = options.ns;
          } else if (options.ns.indexOf("translation") < 0) {
            options.defaultNS = options.ns[0];
          }
        }
        const defOpts = get();
        this.options = {
          ...defOpts,
          ...this.options,
          ...transformOptions(options)
        };
        if (this.options.compatibilityAPI !== "v1") {
          this.options.interpolation = {
            ...defOpts.interpolation,
            ...this.options.interpolation
          };
        }
        if (options.keySeparator !== void 0) {
          this.options.userDefinedKeySeparator = options.keySeparator;
        }
        if (options.nsSeparator !== void 0) {
          this.options.userDefinedNsSeparator = options.nsSeparator;
        }
        const createClassOnDemand = (ClassOrObject) => {
          if (!ClassOrObject) return null;
          if (typeof ClassOrObject === "function") return new ClassOrObject();
          return ClassOrObject;
        };
        if (!this.options.isClone) {
          if (this.modules.logger) {
            baseLogger.init(createClassOnDemand(this.modules.logger), this.options);
          } else {
            baseLogger.init(null, this.options);
          }
          let formatter;
          if (this.modules.formatter) {
            formatter = this.modules.formatter;
          } else if (typeof Intl !== "undefined") {
            formatter = Formatter;
          }
          const lu = new LanguageUtil(this.options);
          this.store = new ResourceStore(this.options.resources, this.options);
          const s = this.services;
          s.logger = baseLogger;
          s.resourceStore = this.store;
          s.languageUtils = lu;
          s.pluralResolver = new PluralResolver(lu, {
            prepend: this.options.pluralSeparator,
            compatibilityJSON: this.options.compatibilityJSON,
            simplifyPluralSuffix: this.options.simplifyPluralSuffix
          });
          if (formatter && (!this.options.interpolation.format || this.options.interpolation.format === defOpts.interpolation.format)) {
            s.formatter = createClassOnDemand(formatter);
            s.formatter.init(s, this.options);
            this.options.interpolation.format = s.formatter.format.bind(s.formatter);
          }
          s.interpolator = new Interpolator(this.options);
          s.utils = {
            hasLoadedNamespace: this.hasLoadedNamespace.bind(this)
          };
          s.backendConnector = new Connector(createClassOnDemand(this.modules.backend), s.resourceStore, s, this.options);
          s.backendConnector.on("*", function(event) {
            for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
              args[_key - 1] = arguments[_key];
            }
            _this.emit(event, ...args);
          });
          if (this.modules.languageDetector) {
            s.languageDetector = createClassOnDemand(this.modules.languageDetector);
            if (s.languageDetector.init) s.languageDetector.init(s, this.options.detection, this.options);
          }
          if (this.modules.i18nFormat) {
            s.i18nFormat = createClassOnDemand(this.modules.i18nFormat);
            if (s.i18nFormat.init) s.i18nFormat.init(this);
          }
          this.translator = new Translator(this.services, this.options);
          this.translator.on("*", function(event) {
            for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
              args[_key2 - 1] = arguments[_key2];
            }
            _this.emit(event, ...args);
          });
          this.modules.external.forEach((m) => {
            if (m.init) m.init(this);
          });
        }
        this.format = this.options.interpolation.format;
        if (!callback) callback = noop;
        if (this.options.fallbackLng && !this.services.languageDetector && !this.options.lng) {
          const codes = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
          if (codes.length > 0 && codes[0] !== "dev") this.options.lng = codes[0];
        }
        if (!this.services.languageDetector && !this.options.lng) {
          this.logger.warn("init: no languageDetector is used and no lng is defined");
        }
        const storeApi = ["getResource", "hasResourceBundle", "getResourceBundle", "getDataByLanguage"];
        storeApi.forEach((fcName) => {
          this[fcName] = function() {
            return _this.store[fcName](...arguments);
          };
        });
        const storeApiChained = ["addResource", "addResources", "addResourceBundle", "removeResourceBundle"];
        storeApiChained.forEach((fcName) => {
          this[fcName] = function() {
            _this.store[fcName](...arguments);
            return _this;
          };
        });
        const deferred = defer();
        const load = () => {
          const finish = (err, t3) => {
            this.isInitializing = false;
            if (this.isInitialized && !this.initializedStoreOnce) this.logger.warn("init: i18next is already initialized. You should call init just once!");
            this.isInitialized = true;
            if (!this.options.isClone) this.logger.log("initialized", this.options);
            this.emit("initialized", this.options);
            deferred.resolve(t3);
            callback(err, t3);
          };
          if (this.languages && this.options.compatibilityAPI !== "v1" && !this.isInitialized) return finish(null, this.t.bind(this));
          this.changeLanguage(this.options.lng, finish);
        };
        if (this.options.resources || !this.options.initImmediate) {
          load();
        } else {
          setTimeout(load, 0);
        }
        return deferred;
      }
      loadResources(language) {
        let callback = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : noop;
        let usedCallback = callback;
        const usedLng = isString(language) ? language : this.language;
        if (typeof language === "function") usedCallback = language;
        if (!this.options.resources || this.options.partialBundledLanguages) {
          if (usedLng && usedLng.toLowerCase() === "cimode" && (!this.options.preload || this.options.preload.length === 0)) return usedCallback();
          const toLoad = [];
          const append = (lng) => {
            if (!lng) return;
            if (lng === "cimode") return;
            const lngs = this.services.languageUtils.toResolveHierarchy(lng);
            lngs.forEach((l) => {
              if (l === "cimode") return;
              if (toLoad.indexOf(l) < 0) toLoad.push(l);
            });
          };
          if (!usedLng) {
            const fallbacks = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
            fallbacks.forEach((l) => append(l));
          } else {
            append(usedLng);
          }
          if (this.options.preload) {
            this.options.preload.forEach((l) => append(l));
          }
          this.services.backendConnector.load(toLoad, this.options.ns, (e) => {
            if (!e && !this.resolvedLanguage && this.language) this.setResolvedLanguage(this.language);
            usedCallback(e);
          });
        } else {
          usedCallback(null);
        }
      }
      reloadResources(lngs, ns, callback) {
        const deferred = defer();
        if (typeof lngs === "function") {
          callback = lngs;
          lngs = void 0;
        }
        if (typeof ns === "function") {
          callback = ns;
          ns = void 0;
        }
        if (!lngs) lngs = this.languages;
        if (!ns) ns = this.options.ns;
        if (!callback) callback = noop;
        this.services.backendConnector.reload(lngs, ns, (err) => {
          deferred.resolve();
          callback(err);
        });
        return deferred;
      }
      use(module) {
        if (!module) throw new Error("You are passing an undefined module! Please check the object you are passing to i18next.use()");
        if (!module.type) throw new Error("You are passing a wrong module! Please check the object you are passing to i18next.use()");
        if (module.type === "backend") {
          this.modules.backend = module;
        }
        if (module.type === "logger" || module.log && module.warn && module.error) {
          this.modules.logger = module;
        }
        if (module.type === "languageDetector") {
          this.modules.languageDetector = module;
        }
        if (module.type === "i18nFormat") {
          this.modules.i18nFormat = module;
        }
        if (module.type === "postProcessor") {
          postProcessor.addPostProcessor(module);
        }
        if (module.type === "formatter") {
          this.modules.formatter = module;
        }
        if (module.type === "3rdParty") {
          this.modules.external.push(module);
        }
        return this;
      }
      setResolvedLanguage(l) {
        if (!l || !this.languages) return;
        if (["cimode", "dev"].indexOf(l) > -1) return;
        for (let li = 0; li < this.languages.length; li++) {
          const lngInLngs = this.languages[li];
          if (["cimode", "dev"].indexOf(lngInLngs) > -1) continue;
          if (this.store.hasLanguageSomeTranslations(lngInLngs)) {
            this.resolvedLanguage = lngInLngs;
            break;
          }
        }
      }
      changeLanguage(lng, callback) {
        var _this2 = this;
        this.isLanguageChangingTo = lng;
        const deferred = defer();
        this.emit("languageChanging", lng);
        const setLngProps = (l) => {
          this.language = l;
          this.languages = this.services.languageUtils.toResolveHierarchy(l);
          this.resolvedLanguage = void 0;
          this.setResolvedLanguage(l);
        };
        const done = (err, l) => {
          if (l) {
            setLngProps(l);
            this.translator.changeLanguage(l);
            this.isLanguageChangingTo = void 0;
            this.emit("languageChanged", l);
            this.logger.log("languageChanged", l);
          } else {
            this.isLanguageChangingTo = void 0;
          }
          deferred.resolve(function() {
            return _this2.t(...arguments);
          });
          if (callback) callback(err, function() {
            return _this2.t(...arguments);
          });
        };
        const setLng = (lngs) => {
          if (!lng && !lngs && this.services.languageDetector) lngs = [];
          const l = isString(lngs) ? lngs : this.services.languageUtils.getBestMatchFromCodes(lngs);
          if (l) {
            if (!this.language) {
              setLngProps(l);
            }
            if (!this.translator.language) this.translator.changeLanguage(l);
            if (this.services.languageDetector && this.services.languageDetector.cacheUserLanguage) this.services.languageDetector.cacheUserLanguage(l);
          }
          this.loadResources(l, (err) => {
            done(err, l);
          });
        };
        if (!lng && this.services.languageDetector && !this.services.languageDetector.async) {
          setLng(this.services.languageDetector.detect());
        } else if (!lng && this.services.languageDetector && this.services.languageDetector.async) {
          if (this.services.languageDetector.detect.length === 0) {
            this.services.languageDetector.detect().then(setLng);
          } else {
            this.services.languageDetector.detect(setLng);
          }
        } else {
          setLng(lng);
        }
        return deferred;
      }
      getFixedT(lng, ns, keyPrefix) {
        var _this3 = this;
        const fixedT = function(key, opts) {
          let options;
          if (typeof opts !== "object") {
            for (var _len3 = arguments.length, rest = new Array(_len3 > 2 ? _len3 - 2 : 0), _key3 = 2; _key3 < _len3; _key3++) {
              rest[_key3 - 2] = arguments[_key3];
            }
            options = _this3.options.overloadTranslationOptionHandler([key, opts].concat(rest));
          } else {
            options = {
              ...opts
            };
          }
          options.lng = options.lng || fixedT.lng;
          options.lngs = options.lngs || fixedT.lngs;
          options.ns = options.ns || fixedT.ns;
          if (options.keyPrefix !== "") options.keyPrefix = options.keyPrefix || keyPrefix || fixedT.keyPrefix;
          const keySeparator = _this3.options.keySeparator || ".";
          let resultKey;
          if (options.keyPrefix && Array.isArray(key)) {
            resultKey = key.map((k) => `${options.keyPrefix}${keySeparator}${k}`);
          } else {
            resultKey = options.keyPrefix ? `${options.keyPrefix}${keySeparator}${key}` : key;
          }
          return _this3.t(resultKey, options);
        };
        if (isString(lng)) {
          fixedT.lng = lng;
        } else {
          fixedT.lngs = lng;
        }
        fixedT.ns = ns;
        fixedT.keyPrefix = keyPrefix;
        return fixedT;
      }
      t() {
        return this.translator && this.translator.translate(...arguments);
      }
      exists() {
        return this.translator && this.translator.exists(...arguments);
      }
      setDefaultNamespace(ns) {
        this.options.defaultNS = ns;
      }
      hasLoadedNamespace(ns) {
        let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        if (!this.isInitialized) {
          this.logger.warn("hasLoadedNamespace: i18next was not initialized", this.languages);
          return false;
        }
        if (!this.languages || !this.languages.length) {
          this.logger.warn("hasLoadedNamespace: i18n.languages were undefined or empty", this.languages);
          return false;
        }
        const lng = options.lng || this.resolvedLanguage || this.languages[0];
        const fallbackLng = this.options ? this.options.fallbackLng : false;
        const lastLng = this.languages[this.languages.length - 1];
        if (lng.toLowerCase() === "cimode") return true;
        const loadNotPending = (l, n) => {
          const loadState = this.services.backendConnector.state[`${l}|${n}`];
          return loadState === -1 || loadState === 0 || loadState === 2;
        };
        if (options.precheck) {
          const preResult = options.precheck(this, loadNotPending);
          if (preResult !== void 0) return preResult;
        }
        if (this.hasResourceBundle(lng, ns)) return true;
        if (!this.services.backendConnector.backend || this.options.resources && !this.options.partialBundledLanguages) return true;
        if (loadNotPending(lng, ns) && (!fallbackLng || loadNotPending(lastLng, ns))) return true;
        return false;
      }
      loadNamespaces(ns, callback) {
        const deferred = defer();
        if (!this.options.ns) {
          if (callback) callback();
          return Promise.resolve();
        }
        if (isString(ns)) ns = [ns];
        ns.forEach((n) => {
          if (this.options.ns.indexOf(n) < 0) this.options.ns.push(n);
        });
        this.loadResources((err) => {
          deferred.resolve();
          if (callback) callback(err);
        });
        return deferred;
      }
      loadLanguages(lngs, callback) {
        const deferred = defer();
        if (isString(lngs)) lngs = [lngs];
        const preloaded = this.options.preload || [];
        const newLngs = lngs.filter((lng) => preloaded.indexOf(lng) < 0 && this.services.languageUtils.isSupportedCode(lng));
        if (!newLngs.length) {
          if (callback) callback();
          return Promise.resolve();
        }
        this.options.preload = preloaded.concat(newLngs);
        this.loadResources((err) => {
          deferred.resolve();
          if (callback) callback(err);
        });
        return deferred;
      }
      dir(lng) {
        if (!lng) lng = this.resolvedLanguage || (this.languages && this.languages.length > 0 ? this.languages[0] : this.language);
        if (!lng) return "rtl";
        const rtlLngs = ["ar", "shu", "sqr", "ssh", "xaa", "yhd", "yud", "aao", "abh", "abv", "acm", "acq", "acw", "acx", "acy", "adf", "ads", "aeb", "aec", "afb", "ajp", "apc", "apd", "arb", "arq", "ars", "ary", "arz", "auz", "avl", "ayh", "ayl", "ayn", "ayp", "bbz", "pga", "he", "iw", "ps", "pbt", "pbu", "pst", "prp", "prd", "ug", "ur", "ydd", "yds", "yih", "ji", "yi", "hbo", "men", "xmn", "fa", "jpr", "peo", "pes", "prs", "dv", "sam", "ckb"];
        const languageUtils = this.services && this.services.languageUtils || new LanguageUtil(get());
        return rtlLngs.indexOf(languageUtils.getLanguagePartFromCode(lng)) > -1 || lng.toLowerCase().indexOf("-arab") > 1 ? "rtl" : "ltr";
      }
      static createInstance() {
        let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        let callback = arguments.length > 1 ? arguments[1] : void 0;
        return new _I18n(options, callback);
      }
      cloneInstance() {
        let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        let callback = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : noop;
        const forkResourceStore = options.forkResourceStore;
        if (forkResourceStore) delete options.forkResourceStore;
        const mergedOptions = {
          ...this.options,
          ...options,
          ...{
            isClone: true
          }
        };
        const clone = new _I18n(mergedOptions);
        if (options.debug !== void 0 || options.prefix !== void 0) {
          clone.logger = clone.logger.clone(options);
        }
        const membersToCopy = ["store", "services", "language"];
        membersToCopy.forEach((m) => {
          clone[m] = this[m];
        });
        clone.services = {
          ...this.services
        };
        clone.services.utils = {
          hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone)
        };
        if (forkResourceStore) {
          clone.store = new ResourceStore(this.store.data, mergedOptions);
          clone.services.resourceStore = clone.store;
        }
        clone.translator = new Translator(clone.services, mergedOptions);
        clone.translator.on("*", function(event) {
          for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
            args[_key4 - 1] = arguments[_key4];
          }
          clone.emit(event, ...args);
        });
        clone.init(mergedOptions, callback);
        clone.translator.options = mergedOptions;
        clone.translator.backendConnector.services.utils = {
          hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone)
        };
        return clone;
      }
      toJSON() {
        return {
          options: this.options,
          store: this.store,
          language: this.language,
          languages: this.languages,
          resolvedLanguage: this.resolvedLanguage
        };
      }
    };
    instance = I18n.createInstance();
    instance.createInstance = I18n.createInstance;
    createInstance = instance.createInstance;
    dir = instance.dir;
    init = instance.init;
    loadResources = instance.loadResources;
    reloadResources = instance.reloadResources;
    use = instance.use;
    changeLanguage = instance.changeLanguage;
    getFixedT = instance.getFixedT;
    t2 = instance.t;
    exists = instance.exists;
    setDefaultNamespace = instance.setDefaultNamespace;
    hasLoadedNamespace = instance.hasLoadedNamespace;
    loadNamespaces = instance.loadNamespaces;
    loadLanguages = instance.loadLanguages;
  }
});

// app/notices/ray-optics/source/sceneObjs/BaseSceneObj.js
var BaseSceneObj, BaseSceneObj_default;
var init_BaseSceneObj = __esm({
  "app/notices/ray-optics/source/sceneObjs/BaseSceneObj.js"() {
    "use strict";
    init_i18next();
    BaseSceneObj = class {
      /**
       * @param {Scene} scene - The scene the object belongs to.
       * @param {Object|null} jsonObj - The JSON object to be deserialized, if any.
       */
      constructor(scene, jsonObj) {
        this.scene = scene;
        this.error = null;
        this.warning = null;
        this.brightnessScale = null;
        this.name = jsonObj?.name || "";
        this.locked = jsonObj?.locked ?? "default";
        if (jsonObj) {
          const serializableDefaults = this.constructor.serializableDefaults;
          const knownKeys = ["type", "name", "locked", ...Object.keys(serializableDefaults)];
          for (const key in jsonObj) {
            if (!knownKeys.includes(key)) {
              this.scene.error = instance.t("simulator:generalErrors.unknownObjectKey", { key, type: this.constructor.type });
            }
          }
          for (const propName in serializableDefaults) {
            const stringifiedDefault = JSON.stringify(serializableDefaults[propName]);
            if (jsonObj.hasOwnProperty(propName)) {
              const stringifiedValue = JSON.stringify(jsonObj[propName]);
              this[propName] = JSON.parse(stringifiedValue);
            } else {
              this[propName] = JSON.parse(stringifiedDefault);
            }
          }
        } else {
          const serializableDefaults = this.constructor.serializableDefaults;
          for (const propName in serializableDefaults) {
            const stringifiedDefault = JSON.stringify(serializableDefaults[propName]);
            this[propName] = JSON.parse(stringifiedDefault);
          }
        }
      }
      /**
       * Serializes the object to a JSON object.
       * @returns {Object} The serialized JSON object.
       */
      serialize() {
        const jsonObj = { type: this.constructor.type };
        const serializableDefaults = {
          name: "",
          locked: "default",
          ...this.constructor.serializableDefaults
        };
        for (const propName in serializableDefaults) {
          const stringifiedValue = JSON.stringify(this[propName]);
          const stringifiedDefault = JSON.stringify(serializableDefaults[propName]);
          if (stringifiedValue !== stringifiedDefault) {
            jsonObj[propName] = JSON.parse(stringifiedValue);
          }
        }
        return jsonObj;
      }
      /**
       * Check whether the given properties of the object are all the default values.
       * @param {string[]} propertyNames - The property names to be checked.
       * @returns {boolean} Whether the properties are all the default values.
       */
      arePropertiesDefault(propertyNames) {
        const serializableDefaults = this.constructor.serializableDefaults;
        for (const propName of propertyNames) {
          const stringifiedValue = JSON.stringify(this[propName]);
          const stringifiedDefault = JSON.stringify(serializableDefaults[propName]);
          if (stringifiedValue !== stringifiedDefault) {
            return false;
          }
        }
        return true;
      }
      /**
       * The type of the object.
       */
      static type = "";
      /**
       * The default values of the properties of the object which are to be serialized. The keys are the property names and the values are the default values. If some properties is default, they will not be serialized and will be deserialized to the default values.
       */
      static serializableDefaults = {};
      /**
       * Whether the object is optical (i.e. is a light source, interacts with rays, or detects rays).
       */
      static isOptical = false;
      /**
       * Whether the object can merge its surface with the surfaces of glasses (here "glass" means a subclass of `BaseGlass`). For glasses this is always true. Suppose a ray is incident on the overlapping surfaces of N+1 objects. If all objects has this property set to true, and N of them are glasses, then `onRayIncident` will be called only on the other one (glass or not), with the N glasses being in `surfaceMergingObjs`. Otherwise, the behavior is undefined, and a warning will be shown.
       */
      static mergesWithGlass = false;
      /**
       * Get a short description of the object for display (e.g. in list items, tooltips).
       * This is a static method that works on raw JSON data (no instance needed), so it can be used
       * for both live objects and module templates.
       * @param {Object} objData - The raw JSON data of the object (or template).
       * @param {Scene|null} scene - The scene instance. Provides access to scene-level definitions (e.g. `scene.modules` for ModuleObj). May be null if not available.
       * @param {boolean} [detailed=false] - If true, include more contextual information (e.g. for TextLabel, the actual text content; for ModuleObj, the module name is always shown).
       * @returns {string} An HTML description. Any dynamic user content must be escaped with `escapeHtml` before interpolation.
       */
      static getDescription(objData, scene, detailed = false) {
        return objData?.type || "";
      }
      /**
       * Get the property schema for this object type. This is for the UI of the visual editor in the sidebar, mainly designed for editing object templates in modules, and not intended for basic usage of this app (unlike the object bar). Therefore, the schema only contains direct properties (not derived from other properties), and are context-independent (e.g. not depend on whether "Simulate Colors" is on). The only context is the "resource"-like information of the scene such as the module parameter names. Also, since it is for module templates, the objData is not the class instance, but the raw JSON data of the object/template.
       * Returns an ordered array of {@link PropertyDescriptor} objects describing all editable properties.
       * This is a static method that works on raw JSON data (no instance needed), so it can be used
       * for both live objects and module templates. The schema is context-independent: it always lists
       * all properties a type can have, regardless of current scene settings.
       * @param {Object} objData - The raw JSON data of the object (or template).
       * @param {Scene} scene - The scene instance. Provides access to scene-level definitions (e.g. `scene.modules`). Must not be used to branch on scene settings.
       * @returns {PropertyDescriptor[]} The property descriptors.
       */
      static getPropertySchema(objData, scene) {
        return [];
      }
      /**
       * Populate the object bar. Note that this is different from the property schema (which is for the sidebar). The object bar is for regular users, and contains whatever properties which are most convenient for the users to edit, so it may contains dependent properties (like focal length of an arc mirror, which is derived from the three points of the arc). And since editing the points for regular users is done in the canvas, their coordinates are not shown in the object bar.
       * Called when the user selects the object (it is selected automatically when the user creates it, so the construction may not be completed at this stage).
       * @param {ObjBar} objBar - The object bar to be populated.
       */
      populateObjBar(objBar) {
      }
      /**
       * Get the z-index of the object for the sequence of drawing.
       * Called before the simulator starts to draw the scene.
       * @returns {number} The z-index. The smaller the number is, the earlier `draw` is called.
       */
      getZIndex() {
        return 0;
      }
      /**
       * Draw the object on the canvas.
       * Called once before the simulator renders the light with `isAboveLight === false` and once after with `isAboveLight === true`.
       * @param {CanvasRenderer} canvasRenderer - The canvas renderer.
       * @param {boolean} isAboveLight - Whether the rendering layer is above the light layer.
       * @param {boolean} isHovered - Whether the object is hovered by the mouse, which determines the style of the object to be drawn, e.g., with lighlighted color.
       */
      draw(canvasRenderer, isAboveLight, isHovered) {
      }
      /**
       * Move the object by the given displacement.
       * Called when the user use arrow keys to move the object.
       * @param {number} diffX - The x-coordinate displacement.
       * @param {number} diffY - The y-coordinate displacement.
       * @returns {boolean} True if the movement is done properly in the sense that if every object is moved by the same displacement, the resulting scene should look essentially the same as if the viewport is moved by the opposite displacement. False otherwise.
       */
      move(diffX, diffY) {
        return false;
      }
      /**
       * Rotate the object by the given angle.
       * @param {number} angle - The angle in radians. Positive for counter-clockwise.
       * @param {Point} center - The center of rotation. If null, there should be a default center of rotation (which is used when the user uses the +/- keys to rotate the object)
       * @returns {boolean} True if the rotation is done properly in the sense that if every object is rotated by the same angle and center, the resulting scene should look essentially the same as if the viewport is rotated by the opposite angle. False otherwise.
       */
      rotate(angle, center) {
        return false;
      }
      /**
       * Scale the object by the given scale factor.
       * @param {number} scale - The scale factor.
       * @param {Point} center - The center of scaling. If null, there should be a default center of scaling.
       * @returns {boolean} True if the scaling is done properly in the sense that if every object is scaled by the same scale factor and center, the resulting scene should look essentially the same as if the viewport is scaled by the same scale factor. False otherwise.
       */
      scale(scale, center) {
        return false;
      }
      /**
       * Get the default center of rotation or scaling.
       * @returns {Point} The default center of rotation or scaling.
       */
      getDefaultCenter() {
        return null;
      }
      /**
       * Mouse down event when the object is being constructed by the user.
       * @param {Mouse} mouse - The mouse object.
       * @param {boolean} ctrl - Whether the control key is pressed.
       * @param {boolean} shift - Whether the shift key is pressed.
       * @returns {ConstructReturn} The return value.
       */
      onConstructMouseDown(mouse, ctrl, shift) {
      }
      /**
       * Mouse move event when the object is being constructed by the user.
       * @param {Mouse} mouse - The mouse object.
       * @param {boolean} ctrl - Whether the control key is pressed.
       * @param {boolean} shift - Whether the shift key is pressed.
       * @returns {ConstructReturn} The return value.
       */
      onConstructMouseMove(mouse, ctrl, shift) {
      }
      /**
       * Mouse up event when the object is being constructed by the user.
       * @param {Mouse} mouse - The mouse object.
       * @param {boolean} ctrl - Whether the control key is pressed.
       * @param {boolean} shift - Whether the shift key is pressed.
       * @returns {ConstructReturn} The return value.
       */
      onConstructMouseUp(mouse, ctrl, shift) {
      }
      /**
       * Undo event when the object is being constructed by the user.
       * @returns {ConstructReturn} The return value.
       */
      onConstructUndo() {
        return {
          isCancelled: true
        };
      }
      /**
       * Check whether the mouse is over the object, which is called when the user moves the mouse over the scene. This is used for deciding the highlighting of the object, and also for deciding that if the user starts dragging at this position, which part of the object should be dragged.
       * @param {Mouse} mouse - The mouse object.
       * @returns {DragContext|null} The drag context if the user starts dragging at this position, or null if the mouse is not over the object.
       */
      checkMouseOver(mouse) {
        return null;
      }
      /**
       * The event when the user drags the object, which is fired on every step during the dragging. The object should be updated according to `DragContext` which is returned by `checkMouseOver`. `dragContext` can be modified during the dragging.
       * @param {Mouse} mouse - The mouse object.
       * @param {DragContext} dragContext - The drag context.
       * @param {boolean} ctrl - Whether the control key is pressed.
       * @param {boolean} shift - Whether the shift key is pressed.
       */
      onDrag(mouse, dragContext, ctrl, shift) {
      }
      /**
       * Return the optical primitives represented by this scene object for the
       * primitive-based simulator. The returned array is flat and its order and
       * original scene-object/module grouping have no simulation meaning.
       *
       * Every curve occurrence is distinct: coincident curves are not
       * deduplicated. Preprocessing extracts all curves from surfaces, regions,
       * and detectors, associates each extracted curve with its owning primitive,
       * and builds the BVH. Light sources contain no curve and generate rays only
       * from their type and parameters.
       *
       * Region-producing scene objects are responsible for returning curves which
       * collectively form a valid closed boundary. The primitive format and
       * preprocessing do not validate closure.
       *
       * The source, surface, bulk, and detector type definitions are intentionally
       * opaque at this interface. Their internal formula representation is defined
       * by the formula compiler rather than by scene objects.
       *
       * Non-optical scene objects return an empty array.
       * @returns {Primitive[]} The optical primitives represented by this object.
       */
      getPrimitives() {
        return [];
      }
      /**
       * The event when the simulation starts.
       * If this object is a light source, it should emit rays here by setting `newRays`. If the object is a detector, it may do some initialization here.
       * @returns {SimulationReturn|null} The return value.
       */
      onSimulationStart() {
      }
      /**
       * Check whether the object intersects with the given ray.
       * Called during the ray tracing when `ray` is to be tested whether it intersects with the object. Find whether they intersect and find the nearset intersection if so. Implemented only by optical elements that affects or detect rays.
       * @param {Ray} ray - The ray.
       * @returns {Point|null} - The intersection (closest to the beginning of the ray) if they intersect.
       */
      checkRayIntersects(ray) {
        return null;
      }
      /**
       * The event when a ray is incident on the object.
       * Called during the ray tracing when `ray` has been calculated to be incident on the object at the `incidentPoint`. Perform the interaction between `ray` and the object. Implemented only by optical elements that affects or detect rays.
       * If `ray` is absorbed by the object, return `{ isAbsorbed: true }`.
       * If there is a primary outgoing ray, directly modify `ray` to be the outgoing ray. This includes the case when the object is a detector that does not modify the direction of the ray.
       * If there are secondary rays to be emitted, return `{ newRays: [ray1, ray2, ...] }`. Note that if there are more than one secondary rays, image detection does not work in the current version, and `rayN.gap` should be set to `true`. But for future support, the secondary ray which is to be of the same continuous bunch or rays should have consistent index in the `newRays` array.
       * Sometimes keeping tracks of all the rays may result in infinite loop (such as in a glass). Depending on the situation, some rays with brightness below a certain threshold (such as 0.01) may be truncated. In this case, the brightness of the truncated rays should be returned as `truncation`.
       * @param {Ray} ray - The ray.
       * @param {number} rayIndex - The index of the ray in the array of all rays currently in the scene in the simulator. In particular, in a bunch of continuous rays, the rays are ordered by the time they are emitted, and the index is the order of emission. This can be used to downsample the rays and increase the individual brightness if it is too low.
       * @param {Point} incidentPoint - The point where the ray is incident on the object, which is the intersection point found by `checkRayIntersects`.
       * @param {Array<BaseGlass>} surfaceMergingObjs - The glass objects that are merged with the current object. When a ray is incident on the overlapping surfaces of N+1 objects with `mergesWithGlass === true`, and N of them are glasses, then this function will be called only on the other one (glass or not), with the N glasses being in this array. The function will need to handle the combination of the surfaces. Note that treating them as two very close surfaces may not give the correct result due to an essential discontinuity of ray optics (which is smoothed out at the scale of the wavelength in reality).
       * @returns {SimulationReturn|null} The return value.
       */
      onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
      }
      /**
       * Get the error message of the object.
       * @returns {string|null} The error message.
       */
      getError() {
        return this.error;
      }
      /**
       * Get the warning message of the object.
       * @returns {string|null} The warning message.
       */
      getWarning() {
        return this.warning;
      }
    };
    BaseSceneObj_default = BaseSceneObj;
  }
});

// app/notices/ray-optics/source/geometry.js
var geometry, geometry_default;
var init_geometry = __esm({
  "app/notices/ray-optics/source/geometry.js"() {
    "use strict";
    geometry = {
      /**
       * Create a point
       * @param {number} x - The x-coordinate of the point.
       * @param {number} y - The y-coordinate of the point.
       * @returns {Point}
       */
      point: function(x, y) {
        return { x, y };
      },
      /**
       * Create a line, which also represents a ray or a segment.
       * When used as a line, p1 and p2 are two distinct points on the line.
       * When used as a ray, p1 is the starting point and p2 is another point on the ray.
       * When used as a segment, p1 and p2 are the two endpoints of the segment.
       * @param {Point} p1
       * @param {Point} p2
       * @returns {Line}
       */
      line: function(p1, p2) {
        return { p1, p2 };
      },
      /**
       * Create a circle
       * @param {Point} c - The center point of the circle.
       * @param {number|Point} r - The radius of the circle or a point on the circle.
       */
      circle: function(c, r) {
        if (typeof r == "object") {
          return { c, r: geometry.line(c, r) };
        } else {
          return { c, r };
        }
      },
      /**
      * Calculate the dot product, where the two points are treated as vectors.
      * @param {Point} p1
      * @param {Point} p2
      * @return {Number}
      **/
      dot: function(p1, p2) {
        return p1.x * p2.x + p1.y * p2.y;
      },
      /**
      * Calculate the cross product, where the two points are treated as vectors.
      * @param {Point} p1
      * @param {Point} p2
      * @return {Number}
      **/
      cross: function(p1, p2) {
        return p1.x * p2.y - p1.y * p2.x;
      },
      /**
      * Calculate the intersection of two lines.
      * @param {Line} l1
      * @param {Line} l2
      * @return {Point}
      **/
      linesIntersection: function(l1, l2) {
        var A = l1.p2.x * l1.p1.y - l1.p1.x * l1.p2.y;
        var B = l2.p2.x * l2.p1.y - l2.p1.x * l2.p2.y;
        var xa = l1.p2.x - l1.p1.x;
        var xb = l2.p2.x - l2.p1.x;
        var ya = l1.p2.y - l1.p1.y;
        var yb = l2.p2.y - l2.p1.y;
        return geometry.point((A * xb - B * xa) / (xa * yb - xb * ya), (A * yb - B * ya) / (xa * yb - xb * ya));
      },
      /**
       * Calculate the intersections of a line and a circle.
       * @param {Line} l1
       * @param {Circle} c1
       * @return {Point[]}
       */
      lineCircleIntersections: function(l1, c1) {
        var xa = l1.p2.x - l1.p1.x;
        var ya = l1.p2.y - l1.p1.y;
        var cx = c1.c.x;
        var cy = c1.c.y;
        var r_sq = typeof c1.r == "object" ? (c1.r.p1.x - c1.r.p2.x) * (c1.r.p1.x - c1.r.p2.x) + (c1.r.p1.y - c1.r.p2.y) * (c1.r.p1.y - c1.r.p2.y) : c1.r * c1.r;
        var l = Math.sqrt(xa * xa + ya * ya);
        var ux = xa / l;
        var uy = ya / l;
        var cu = (cx - l1.p1.x) * ux + (cy - l1.p1.y) * uy;
        var px = l1.p1.x + cu * ux;
        var py = l1.p1.y + cu * uy;
        var d = Math.sqrt(r_sq - (px - cx) * (px - cx) - (py - cy) * (py - cy));
        var ret = [];
        ret[1] = geometry.point(px + ux * d, py + uy * d);
        ret[2] = geometry.point(px - ux * d, py - uy * d);
        return ret;
      },
      /**
       * Calculate the intersections of a line and a curve.
       * @param {Line} l1
       * @param {Bezier} c1
       * @return {Point[]}
       */
      lineCurveIntersections: function(l1, c1) {
        return c1.intersects(l1);
      },
      /**
       * Test if a point on the extension of a ray is actually on the ray.
       * @param {Point} p1
       * @param {Line} r1
       * @return {Boolean}
       */
      intersectionIsOnRay: function(p1, r1) {
        return (p1.x - r1.p1.x) * (r1.p2.x - r1.p1.x) + (p1.y - r1.p1.y) * (r1.p2.y - r1.p1.y) >= 0;
      },
      /**
       * Test if a point on the extension of a segment is actually on the segment.
       * @param {Point} p1
       * @param {Line} s1
       * @return {Boolean}
       */
      intersectionIsOnSegment: function(p1, s1) {
        return (p1.x - s1.p1.x) * (s1.p2.x - s1.p1.x) + (p1.y - s1.p1.y) * (s1.p2.y - s1.p1.y) >= 0 && (p1.x - s1.p2.x) * (s1.p1.x - s1.p2.x) + (p1.y - s1.p2.y) * (s1.p1.y - s1.p2.y) >= 0;
      },
      /**
       * Test if a point on the extension of a curve is actually on the curve.
       * @param {Point} p1
       * @param {Bezier} curve
       * @return {Boolean}
       */
      intersectionIsOnCurve: function(p1, curve, threshold) {
        var d_proj = curve.project(geometry.point(p1.x, p1.y)).d;
        return Math.pow(d_proj, 2) < threshold;
      },
      /**
       * Scale the ray based on the bounding box of the curve.
       * @param {Line} r1
       * @param {Bezier} curve
       * @return {Line} - Returns the vector pointing from r1.p1 to the farthest point on the curve's bounding box.
       */
      scaleRayForCurve: function(r1, curve) {
        var bbox = curve.bbox();
        bbox.x.min -= r1.p1.x;
        bbox.x.max -= r1.p1.x;
        bbox.y.min -= r1.p1.y;
        bbox.y.max -= r1.p1.y;
        var v1 = geometry.point(r1.p2.x - r1.p1.x, r1.p2.y - r1.p1.y);
        var farthest = { x: Infinity, y: Infinity };
        if (Math.abs(bbox.x.min) > Math.abs(bbox.x.max)) {
          farthest.x = bbox.x.min;
        } else {
          farthest.x = bbox.x.max;
        }
        if (Math.abs(bbox.y.min) > Math.abs(bbox.y.max)) {
          farthest.y = bbox.y.min;
        } else {
          farthest.y = bbox.y.max;
        }
        var dist = Math.sqrt(farthest.x ** 2 + farthest.y ** 2);
        var len_v1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
        v1.x = v1.x / len_v1 * dist * 1.001;
        v1.y = v1.y / len_v1 * dist * 1.001;
        return geometry.line(r1.p1, geometry.point(v1.x + r1.p1.x, v1.y + r1.p1.y));
      },
      /**
       * Calculate the length of a line segment.
       * @param {Line} seg
       * @return {Number}
       */
      segmentLength: function(seg) {
        return Math.sqrt(geometry.segmentLengthSquared(seg));
      },
      /**
       * Calculate the squared length of a line segment.
       * @param {Line} seg
       * @return {Number}
       */
      segmentLengthSquared: function(seg) {
        return geometry.distanceSquared(seg.p1, seg.p2);
      },
      /**
       * Calculate the distance between two points.
       * @param {Point} p1
       * @param {Point} p2
       * @return {Number}
       */
      distance: function(p1, p2) {
        return Math.sqrt(geometry.distanceSquared(p1, p2));
      },
      /**
       * Calculate the squared distance between two points.
       * @param {Point} p1
       * @param {Point} p2
       * @return {Number}
       */
      distanceSquared: function(p1, p2) {
        var dx = p1.x - p2.x;
        var dy = p1.y - p2.y;
        return dx * dx + dy * dy;
      },
      /**
       * Calculate the midpoint of a segment.
       * @param {Line} l1
       * @return {Point}
       */
      segmentMidpoint: function(l1) {
        var nx = (l1.p1.x + l1.p2.x) * 0.5;
        var ny = (l1.p1.y + l1.p2.y) * 0.5;
        return geometry.point(nx, ny);
      },
      /**
       * Calculate the midpoint between two points.
       * @param {Point} p1
       * @param {Point} p2
       * @return {Point}
       */
      midpoint: function(p1, p2) {
        var nx = (p1.x + p2.x) * 0.5;
        var ny = (p1.y + p2.y) * 0.5;
        return geometry.point(nx, ny);
      },
      /**
       * Calculate the perpendicular bisector of a segment.
       * @param {Line} l1
       * @return {Line}
       */
      perpendicularBisector: function(l1) {
        return geometry.line(
          geometry.point(
            (-l1.p1.y + l1.p2.y + l1.p1.x + l1.p2.x) * 0.5,
            (l1.p1.x - l1.p2.x + l1.p1.y + l1.p2.y) * 0.5
          ),
          geometry.point(
            (l1.p1.y - l1.p2.y + l1.p1.x + l1.p2.x) * 0.5,
            (-l1.p1.x + l1.p2.x + l1.p1.y + l1.p2.y) * 0.5
          )
        );
      },
      /**
      * Calculate the line though p1 and parallel to l1.
      * @param {Line} l1
      * @param {Point} p1
      * @return {Line}
      */
      parallelLineThroughPoint: function(l1, p1) {
        var dx = l1.p2.x - l1.p1.x;
        var dy = l1.p2.y - l1.p1.y;
        return geometry.line(p1, geometry.point(p1.x + dx, p1.y + dy));
      },
      /**
       * Normalize the given point as if it were a vector.
       * @param {Point} p1
       * @return {Point}
       */
      normalizeVec: function(p1) {
        var len = geometry.distance(geometry.point(0, 0), p1);
        return geometry.point(p1.x / len, p1.y / len);
      },
      /**
       * Rotate the given point as if it were a vector by the given angle in radians.
       * @param {Point} p1
       * @return {Point}
       */
      rotateVec: function(p1, angle) {
        return {
          x: p1.x * Math.cos(angle) - p1.y * Math.sin(angle),
          y: p1.x * Math.sin(angle) + p1.y * Math.cos(angle)
        };
      }
    };
    geometry_default = geometry;
  }
});

// app/notices/ray-optics/source/sceneObjs/LineObjMixin.js
var LineObjMixin, LineObjMixin_default;
var init_LineObjMixin = __esm({
  "app/notices/ray-optics/source/sceneObjs/LineObjMixin.js"() {
    "use strict";
    init_geometry();
    init_BaseSceneObj();
    init_i18next();
    LineObjMixin = (Base) => class extends Base {
      static getPropertySchema(objData, scene) {
        return [
          { key: "p1", type: "point", label: instance.t("simulator:sceneObjs.LineObjMixin.endpoint1") },
          { key: "p2", type: "point", label: instance.t("simulator:sceneObjs.LineObjMixin.endpoint2") },
          ...super.getPropertySchema(objData, scene)
        ];
      }
      move(diffX, diffY) {
        this.p1.x = this.p1.x + diffX;
        this.p1.y = this.p1.y + diffY;
        this.p2.x = this.p2.x + diffX;
        this.p2.y = this.p2.y + diffY;
        return true;
      }
      rotate(angle, center) {
        const rotationCenter = center || this.getDefaultCenter();
        const diff_p1_x = this.p1.x - rotationCenter.x;
        const diff_p1_y = this.p1.y - rotationCenter.y;
        const diff_p2_x = this.p2.x - rotationCenter.x;
        const diff_p2_y = this.p2.y - rotationCenter.y;
        this.p1.x = rotationCenter.x + diff_p1_x * Math.cos(angle) - diff_p1_y * Math.sin(angle);
        this.p1.y = rotationCenter.y + diff_p1_x * Math.sin(angle) + diff_p1_y * Math.cos(angle);
        this.p2.x = rotationCenter.x + diff_p2_x * Math.cos(angle) - diff_p2_y * Math.sin(angle);
        this.p2.y = rotationCenter.y + diff_p2_x * Math.sin(angle) + diff_p2_y * Math.cos(angle);
        return true;
      }
      scale(scale, center) {
        const scalingCenter = center || this.getDefaultCenter();
        const diff_p1_x = this.p1.x - scalingCenter.x;
        const diff_p1_y = this.p1.y - scalingCenter.y;
        const diff_p2_x = this.p2.x - scalingCenter.x;
        const diff_p2_y = this.p2.y - scalingCenter.y;
        this.p1.x = scalingCenter.x + diff_p1_x * scale;
        this.p1.y = scalingCenter.y + diff_p1_y * scale;
        this.p2.x = scalingCenter.x + diff_p2_x * scale;
        this.p2.y = scalingCenter.y + diff_p2_y * scale;
        return true;
      }
      getDefaultCenter() {
        return geometry_default.point(
          (this.p1.x + this.p2.x) / 2,
          (this.p1.y + this.p2.y) / 2
        );
      }
      onConstructMouseDown(mouse, ctrl, shift) {
        if (!this.constructionPoint) {
          this.constructionPoint = mouse.getPosSnappedToGrid();
          this.p1 = this.constructionPoint;
          this.p2 = this.constructionPoint;
        }
        if (shift) {
          this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
        } else {
          this.p2 = mouse.getPosSnappedToGrid();
        }
      }
      onConstructMouseMove(mouse, ctrl, shift) {
        if (shift) {
          this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
        } else {
          this.p2 = mouse.getPosSnappedToGrid();
        }
        this.p1 = ctrl ? geometry_default.point(2 * this.constructionPoint.x - this.p2.x, 2 * this.constructionPoint.y - this.p2.y) : this.constructionPoint;
      }
      onConstructMouseUp(mouse, ctrl, shift) {
        if (!mouse.snapsOnPoint(this.p1)) {
          delete this.constructionPoint;
          return {
            isDone: true
          };
        }
      }
      checkMouseOver(mouse) {
        let dragContext = {};
        if (mouse.isOnPoint(this.p1) && geometry_default.distanceSquared(mouse.pos, this.p1) <= geometry_default.distanceSquared(mouse.pos, this.p2)) {
          dragContext.part = 1;
          dragContext.targetPoint = geometry_default.point(this.p1.x, this.p1.y);
          return dragContext;
        }
        if (mouse.isOnPoint(this.p2)) {
          dragContext.part = 2;
          dragContext.targetPoint = geometry_default.point(this.p2.x, this.p2.y);
          return dragContext;
        }
        if (mouse.isOnSegment(this)) {
          const mousePos = mouse.getPosSnappedToGrid();
          dragContext.part = 0;
          dragContext.mousePos0 = mousePos;
          dragContext.mousePos1 = mousePos;
          dragContext.snapContext = {};
          return dragContext;
        }
      }
      onDrag(mouse, dragContext, ctrl, shift) {
        var basePoint;
        if (dragContext.part == 1) {
          basePoint = ctrl ? geometry_default.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p2;
          this.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: dragContext.originalObj.p2.x - dragContext.originalObj.p1.x, y: dragContext.originalObj.p2.y - dragContext.originalObj.p1.y }]) : mouse.getPosSnappedToGrid();
          this.p2 = ctrl ? geometry_default.point(2 * basePoint.x - this.p1.x, 2 * basePoint.y - this.p1.y) : basePoint;
        }
        if (dragContext.part == 2) {
          basePoint = ctrl ? geometry_default.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p1;
          this.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: dragContext.originalObj.p2.x - dragContext.originalObj.p1.x, y: dragContext.originalObj.p2.y - dragContext.originalObj.p1.y }]) : mouse.getPosSnappedToGrid();
          this.p1 = ctrl ? geometry_default.point(2 * basePoint.x - this.p2.x, 2 * basePoint.y - this.p2.y) : basePoint;
        }
        if (dragContext.part == 0) {
          if (shift) {
            var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: dragContext.originalObj.p2.x - dragContext.originalObj.p1.x, y: dragContext.originalObj.p2.y - dragContext.originalObj.p1.y }, { x: dragContext.originalObj.p2.y - dragContext.originalObj.p1.y, y: -(dragContext.originalObj.p2.x - dragContext.originalObj.p1.x) }], dragContext.snapContext);
          } else {
            var mousePos = mouse.getPosSnappedToGrid();
            dragContext.snapContext = {};
          }
          var mouseDiffX = dragContext.mousePos1.x - mousePos.x;
          var mouseDiffY = dragContext.mousePos1.y - mousePos.y;
          this.p1.x = this.p1.x - mouseDiffX;
          this.p1.y = this.p1.y - mouseDiffY;
          this.p2.x = this.p2.x - mouseDiffX;
          this.p2.y = this.p2.y - mouseDiffY;
          dragContext.mousePos1 = mousePos;
        }
      }
      /**
       * Check if a ray intersects the line segment.
       * In the child class, this can be called from the `checkRayIntersects` method.
       * @param {Ray} ray - The ray.
       * @returns {Point} The intersection point, or null if there is no intersection.
       */
      checkRayIntersectsShape(ray) {
        var rp_temp = geometry_default.linesIntersection(geometry_default.line(ray.p1, ray.p2), geometry_default.line(this.p1, this.p2));
        if (geometry_default.intersectionIsOnSegment(rp_temp, this) && geometry_default.intersectionIsOnRay(rp_temp, ray)) {
          return rp_temp;
        } else {
          return null;
        }
      }
    };
    LineObjMixin_default = LineObjMixin;
  }
});

// app/node_modules/.pnpm/canvas2svg@1.0.16/node_modules/canvas2svg/canvas2svg.js
var require_canvas2svg = __commonJS({
  "app/node_modules/.pnpm/canvas2svg@1.0.16/node_modules/canvas2svg/canvas2svg.js"(exports, module) {
    (function() {
      "use strict";
      var STYLES, ctx, CanvasGradient, CanvasPattern, namedEntities;
      function format(str, args) {
        var keys = Object.keys(args), i;
        for (i = 0; i < keys.length; i++) {
          str = str.replace(new RegExp("\\{" + keys[i] + "\\}", "gi"), args[keys[i]]);
        }
        return str;
      }
      function randomString(holder) {
        var chars2, randomstring, i;
        if (!holder) {
          throw new Error("cannot create a random attribute name for an undefined object");
        }
        chars2 = "ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
        randomstring = "";
        do {
          randomstring = "";
          for (i = 0; i < 12; i++) {
            randomstring += chars2[Math.floor(Math.random() * chars2.length)];
          }
        } while (holder[randomstring]);
        return randomstring;
      }
      function createNamedToNumberedLookup(items, radix) {
        var i, entity, lookup = {}, base10, base16;
        items = items.split(",");
        radix = radix || 10;
        for (i = 0; i < items.length; i += 2) {
          entity = "&" + items[i + 1] + ";";
          base10 = parseInt(items[i], radix);
          lookup[entity] = "&#" + base10 + ";";
        }
        lookup["\\xa0"] = "&#160;";
        return lookup;
      }
      function getTextAnchor(textAlign) {
        var mapping = { "left": "start", "right": "end", "center": "middle", "start": "start", "end": "end" };
        return mapping[textAlign] || mapping.start;
      }
      function getDominantBaseline(textBaseline) {
        var mapping = { "alphabetic": "alphabetic", "hanging": "hanging", "top": "text-before-edge", "bottom": "text-after-edge", "middle": "central" };
        return mapping[textBaseline] || mapping.alphabetic;
      }
      namedEntities = createNamedToNumberedLookup(
        "50,nbsp,51,iexcl,52,cent,53,pound,54,curren,55,yen,56,brvbar,57,sect,58,uml,59,copy,5a,ordf,5b,laquo,5c,not,5d,shy,5e,reg,5f,macr,5g,deg,5h,plusmn,5i,sup2,5j,sup3,5k,acute,5l,micro,5m,para,5n,middot,5o,cedil,5p,sup1,5q,ordm,5r,raquo,5s,frac14,5t,frac12,5u,frac34,5v,iquest,60,Agrave,61,Aacute,62,Acirc,63,Atilde,64,Auml,65,Aring,66,AElig,67,Ccedil,68,Egrave,69,Eacute,6a,Ecirc,6b,Euml,6c,Igrave,6d,Iacute,6e,Icirc,6f,Iuml,6g,ETH,6h,Ntilde,6i,Ograve,6j,Oacute,6k,Ocirc,6l,Otilde,6m,Ouml,6n,times,6o,Oslash,6p,Ugrave,6q,Uacute,6r,Ucirc,6s,Uuml,6t,Yacute,6u,THORN,6v,szlig,70,agrave,71,aacute,72,acirc,73,atilde,74,auml,75,aring,76,aelig,77,ccedil,78,egrave,79,eacute,7a,ecirc,7b,euml,7c,igrave,7d,iacute,7e,icirc,7f,iuml,7g,eth,7h,ntilde,7i,ograve,7j,oacute,7k,ocirc,7l,otilde,7m,ouml,7n,divide,7o,oslash,7p,ugrave,7q,uacute,7r,ucirc,7s,uuml,7t,yacute,7u,thorn,7v,yuml,ci,fnof,sh,Alpha,si,Beta,sj,Gamma,sk,Delta,sl,Epsilon,sm,Zeta,sn,Eta,so,Theta,sp,Iota,sq,Kappa,sr,Lambda,ss,Mu,st,Nu,su,Xi,sv,Omicron,t0,Pi,t1,Rho,t3,Sigma,t4,Tau,t5,Upsilon,t6,Phi,t7,Chi,t8,Psi,t9,Omega,th,alpha,ti,beta,tj,gamma,tk,delta,tl,epsilon,tm,zeta,tn,eta,to,theta,tp,iota,tq,kappa,tr,lambda,ts,mu,tt,nu,tu,xi,tv,omicron,u0,pi,u1,rho,u2,sigmaf,u3,sigma,u4,tau,u5,upsilon,u6,phi,u7,chi,u8,psi,u9,omega,uh,thetasym,ui,upsih,um,piv,812,bull,816,hellip,81i,prime,81j,Prime,81u,oline,824,frasl,88o,weierp,88h,image,88s,real,892,trade,89l,alefsym,8cg,larr,8ch,uarr,8ci,rarr,8cj,darr,8ck,harr,8dl,crarr,8eg,lArr,8eh,uArr,8ei,rArr,8ej,dArr,8ek,hArr,8g0,forall,8g2,part,8g3,exist,8g5,empty,8g7,nabla,8g8,isin,8g9,notin,8gb,ni,8gf,prod,8gh,sum,8gi,minus,8gn,lowast,8gq,radic,8gt,prop,8gu,infin,8h0,ang,8h7,and,8h8,or,8h9,cap,8ha,cup,8hb,int,8hk,there4,8hs,sim,8i5,cong,8i8,asymp,8j0,ne,8j1,equiv,8j4,le,8j5,ge,8k2,sub,8k3,sup,8k4,nsub,8k6,sube,8k7,supe,8kl,oplus,8kn,otimes,8l5,perp,8m5,sdot,8o8,lceil,8o9,rceil,8oa,lfloor,8ob,rfloor,8p9,lang,8pa,rang,9ea,loz,9j0,spades,9j3,clubs,9j5,hearts,9j6,diams,ai,OElig,aj,oelig,b0,Scaron,b1,scaron,bo,Yuml,m6,circ,ms,tilde,802,ensp,803,emsp,809,thinsp,80c,zwnj,80d,zwj,80e,lrm,80f,rlm,80j,ndash,80k,mdash,80o,lsquo,80p,rsquo,80q,sbquo,80s,ldquo,80t,rdquo,80u,bdquo,810,dagger,811,Dagger,81g,permil,81p,lsaquo,81q,rsaquo,85c,euro",
        32
      );
      STYLES = {
        "strokeStyle": {
          svgAttr: "stroke",
          //corresponding svg attribute
          canvas: "#000000",
          //canvas default
          svg: "none",
          //svg default
          apply: "stroke"
          //apply on stroke() or fill()
        },
        "fillStyle": {
          svgAttr: "fill",
          canvas: "#000000",
          svg: null,
          //svg default is black, but we need to special case this to handle canvas stroke without fill
          apply: "fill"
        },
        "lineCap": {
          svgAttr: "stroke-linecap",
          canvas: "butt",
          svg: "butt",
          apply: "stroke"
        },
        "lineJoin": {
          svgAttr: "stroke-linejoin",
          canvas: "miter",
          svg: "miter",
          apply: "stroke"
        },
        "miterLimit": {
          svgAttr: "stroke-miterlimit",
          canvas: 10,
          svg: 4,
          apply: "stroke"
        },
        "lineWidth": {
          svgAttr: "stroke-width",
          canvas: 1,
          svg: 1,
          apply: "stroke"
        },
        "globalAlpha": {
          svgAttr: "opacity",
          canvas: 1,
          svg: 1,
          apply: "fill stroke"
        },
        "font": {
          //font converts to multiple svg attributes, there is custom logic for this
          canvas: "10px sans-serif"
        },
        "shadowColor": {
          canvas: "#000000"
        },
        "shadowOffsetX": {
          canvas: 0
        },
        "shadowOffsetY": {
          canvas: 0
        },
        "shadowBlur": {
          canvas: 0
        },
        "textAlign": {
          canvas: "start"
        },
        "textBaseline": {
          canvas: "alphabetic"
        }
      };
      CanvasGradient = function(gradientNode, ctx2) {
        this.__root = gradientNode;
        this.__ctx = ctx2;
      };
      CanvasGradient.prototype.addColorStop = function(offset, color) {
        var stop = this.__ctx.__createElement("stop"), regex, matches;
        stop.setAttribute("offset", offset);
        if (color.indexOf("rgba") !== -1) {
          regex = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d?\.?\d*)\s*\)/gi;
          matches = regex.exec(color);
          stop.setAttribute("stop-color", format("rgb({r},{g},{b})", { r: matches[1], g: matches[2], b: matches[3] }));
          stop.setAttribute("stop-opacity", matches[4]);
        } else {
          stop.setAttribute("stop-color", color);
        }
        this.__root.appendChild(stop);
      };
      CanvasPattern = function(pattern, ctx2) {
        this.__root = pattern;
        this.__ctx = ctx2;
      };
      ctx = function(o) {
        var defaultOptions = { width: 500, height: 500, enableMirroring: false }, options;
        if (arguments.length > 1) {
          options = defaultOptions;
          options.width = arguments[0];
          options.height = arguments[1];
        } else if (!o) {
          options = defaultOptions;
        } else {
          options = o;
        }
        if (!(this instanceof ctx)) {
          return new ctx(options);
        }
        this.width = options.width || defaultOptions.width;
        this.height = options.height || defaultOptions.height;
        this.enableMirroring = options.enableMirroring !== void 0 ? options.enableMirroring : defaultOptions.enableMirroring;
        this.canvas = this;
        this.__document = options.document || document;
        this.__canvas = this.__document.createElement("canvas");
        this.__ctx = this.__canvas.getContext("2d");
        this.__setDefaultStyles();
        this.__stack = [this.__getStyleState()];
        this.__groupStack = [];
        this.__root = this.__document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.__root.setAttribute("version", 1.1);
        this.__root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        this.__root.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
        this.__root.setAttribute("width", this.width);
        this.__root.setAttribute("height", this.height);
        this.__ids = {};
        this.__defs = this.__document.createElementNS("http://www.w3.org/2000/svg", "defs");
        this.__root.appendChild(this.__defs);
        this.__currentElement = this.__document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.__root.appendChild(this.__currentElement);
      };
      ctx.prototype.__createElement = function(elementName, properties, resetFill) {
        if (typeof properties === "undefined") {
          properties = {};
        }
        var element = this.__document.createElementNS("http://www.w3.org/2000/svg", elementName), keys = Object.keys(properties), i, key;
        if (resetFill) {
          element.setAttribute("fill", "none");
          element.setAttribute("stroke", "none");
        }
        for (i = 0; i < keys.length; i++) {
          key = keys[i];
          element.setAttribute(key, properties[key]);
        }
        return element;
      };
      ctx.prototype.__setDefaultStyles = function() {
        var keys = Object.keys(STYLES), i, key;
        for (i = 0; i < keys.length; i++) {
          key = keys[i];
          this[key] = STYLES[key].canvas;
        }
      };
      ctx.prototype.__applyStyleState = function(styleState) {
        var keys = Object.keys(styleState), i, key;
        for (i = 0; i < keys.length; i++) {
          key = keys[i];
          this[key] = styleState[key];
        }
      };
      ctx.prototype.__getStyleState = function() {
        var i, styleState = {}, keys = Object.keys(STYLES), key;
        for (i = 0; i < keys.length; i++) {
          key = keys[i];
          styleState[key] = this[key];
        }
        return styleState;
      };
      ctx.prototype.__applyStyleToCurrentElement = function(type) {
        var keys = Object.keys(STYLES), i, style, value, id, regex, matches;
        for (i = 0; i < keys.length; i++) {
          style = STYLES[keys[i]];
          value = this[keys[i]];
          if (style.apply) {
            if (style.apply.indexOf("fill") !== -1 && value instanceof CanvasPattern) {
              if (value.__ctx) {
                while (value.__ctx.__defs.childNodes.length) {
                  id = value.__ctx.__defs.childNodes[0].getAttribute("id");
                  this.__ids[id] = id;
                  this.__defs.appendChild(value.__ctx.__defs.childNodes[0]);
                }
              }
              this.__currentElement.setAttribute("fill", format("url(#{id})", { id: value.__root.getAttribute("id") }));
            } else if (style.apply.indexOf("fill") !== -1 && value instanceof CanvasGradient) {
              this.__currentElement.setAttribute("fill", format("url(#{id})", { id: value.__root.getAttribute("id") }));
            } else if (style.apply.indexOf(type) !== -1 && style.svg !== value) {
              if ((style.svgAttr === "stroke" || style.svgAttr === "fill") && value.indexOf("rgba") !== -1) {
                regex = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d?\.?\d*)\s*\)/gi;
                matches = regex.exec(value);
                this.__currentElement.setAttribute(style.svgAttr, format("rgb({r},{g},{b})", { r: matches[1], g: matches[2], b: matches[3] }));
                this.__currentElement.setAttribute(style.svgAttr + "-opacity", matches[4]);
              } else {
                this.__currentElement.setAttribute(style.svgAttr, value);
              }
            }
          }
        }
      };
      ctx.prototype.__closestGroupOrSvg = function(node) {
        node = node || this.__currentElement;
        if (node.nodeName === "g" || node.nodeName === "svg") {
          return node;
        } else {
          return this.__closestGroupOrSvg(node.parentNode);
        }
      };
      ctx.prototype.getSerializedSvg = function(fixNamedEntities) {
        var serialized = new XMLSerializer().serializeToString(this.__root), keys, i, key, value, regexp, xmlns;
        xmlns = /xmlns="http:\/\/www\.w3\.org\/2000\/svg".+xmlns="http:\/\/www\.w3\.org\/2000\/svg/gi;
        if (xmlns.test(serialized)) {
          serialized = serialized.replace('xmlns="http://www.w3.org/2000/svg', 'xmlns:xlink="http://www.w3.org/1999/xlink');
        }
        if (fixNamedEntities) {
          keys = Object.keys(namedEntities);
          for (i = 0; i < keys.length; i++) {
            key = keys[i];
            value = namedEntities[key];
            regexp = new RegExp(key, "gi");
            if (regexp.test(serialized)) {
              serialized = serialized.replace(regexp, value);
            }
          }
        }
        return serialized;
      };
      ctx.prototype.getSvg = function() {
        return this.__root;
      };
      ctx.prototype.save = function() {
        var group = this.__createElement("g"), parent = this.__closestGroupOrSvg();
        this.__groupStack.push(parent);
        parent.appendChild(group);
        this.__currentElement = group;
        this.__stack.push(this.__getStyleState());
      };
      ctx.prototype.restore = function() {
        this.__currentElement = this.__groupStack.pop();
        var state = this.__stack.pop();
        this.__applyStyleState(state);
      };
      ctx.prototype.__addTransform = function(t3) {
        var parent = this.__closestGroupOrSvg();
        if (parent.childNodes.length > 0) {
          var group = this.__createElement("g");
          parent.appendChild(group);
          this.__currentElement = group;
        }
        var transform = this.__currentElement.getAttribute("transform");
        if (transform) {
          transform += " ";
        } else {
          transform = "";
        }
        transform += t3;
        this.__currentElement.setAttribute("transform", transform);
      };
      ctx.prototype.scale = function(x, y) {
        if (y === void 0) {
          y = x;
        }
        this.__addTransform(format("scale({x},{y})", { x, y }));
      };
      ctx.prototype.rotate = function(angle) {
        var degrees = angle * 180 / Math.PI;
        this.__addTransform(format("rotate({angle},{cx},{cy})", { angle: degrees, cx: 0, cy: 0 }));
      };
      ctx.prototype.translate = function(x, y) {
        this.__addTransform(format("translate({x},{y})", { x, y }));
      };
      ctx.prototype.transform = function(a, b, c, d, e, f) {
        this.__addTransform(format("matrix({a},{b},{c},{d},{e},{f})", { a, b, c, d, e, f }));
      };
      ctx.prototype.beginPath = function() {
        var path, parent;
        this.__currentDefaultPath = "";
        this.__currentPosition = {};
        path = this.__createElement("path", {}, true);
        parent = this.__closestGroupOrSvg();
        parent.appendChild(path);
        this.__currentElement = path;
      };
      ctx.prototype.__applyCurrentDefaultPath = function() {
        if (this.__currentElement.nodeName === "path") {
          var d = this.__currentDefaultPath;
          this.__currentElement.setAttribute("d", d);
        } else {
          throw new Error("Attempted to apply path command to node " + this.__currentElement.nodeName);
        }
      };
      ctx.prototype.__addPathCommand = function(command) {
        this.__currentDefaultPath += " ";
        this.__currentDefaultPath += command;
      };
      ctx.prototype.moveTo = function(x, y) {
        if (this.__currentElement.nodeName !== "path") {
          this.beginPath();
        }
        this.__currentPosition = { x, y };
        this.__addPathCommand(format("M {x} {y}", { x, y }));
      };
      ctx.prototype.closePath = function() {
        this.__addPathCommand("Z");
      };
      ctx.prototype.lineTo = function(x, y) {
        this.__currentPosition = { x, y };
        if (this.__currentDefaultPath.indexOf("M") > -1) {
          this.__addPathCommand(format("L {x} {y}", { x, y }));
        } else {
          this.__addPathCommand(format("M {x} {y}", { x, y }));
        }
      };
      ctx.prototype.bezierCurveTo = function(cp1x, cp1y, cp2x, cp2y, x, y) {
        this.__currentPosition = { x, y };
        this.__addPathCommand(format(
          "C {cp1x} {cp1y} {cp2x} {cp2y} {x} {y}",
          { cp1x, cp1y, cp2x, cp2y, x, y }
        ));
      };
      ctx.prototype.quadraticCurveTo = function(cpx, cpy, x, y) {
        this.__currentPosition = { x, y };
        this.__addPathCommand(format("Q {cpx} {cpy} {x} {y}", { cpx, cpy, x, y }));
      };
      var normalize = function(vector) {
        var len = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
        return [vector[0] / len, vector[1] / len];
      };
      ctx.prototype.arcTo = function(x1, y1, x2, y2, radius) {
        var x0 = this.__currentPosition && this.__currentPosition.x;
        var y0 = this.__currentPosition && this.__currentPosition.y;
        if (typeof x0 == "undefined" || typeof y0 == "undefined") {
          return;
        }
        if (radius < 0) {
          throw new Error("IndexSizeError: The radius provided (" + radius + ") is negative.");
        }
        if (x0 === x1 && y0 === y1 || x1 === x2 && y1 === y2 || radius === 0) {
          this.lineTo(x1, y1);
          return;
        }
        var unit_vec_p1_p0 = normalize([x0 - x1, y0 - y1]);
        var unit_vec_p1_p2 = normalize([x2 - x1, y2 - y1]);
        if (unit_vec_p1_p0[0] * unit_vec_p1_p2[1] === unit_vec_p1_p0[1] * unit_vec_p1_p2[0]) {
          this.lineTo(x1, y1);
          return;
        }
        var cos3 = unit_vec_p1_p0[0] * unit_vec_p1_p2[0] + unit_vec_p1_p0[1] * unit_vec_p1_p2[1];
        var theta = Math.acos(Math.abs(cos3));
        var unit_vec_p1_origin = normalize([
          unit_vec_p1_p0[0] + unit_vec_p1_p2[0],
          unit_vec_p1_p0[1] + unit_vec_p1_p2[1]
        ]);
        var len_p1_origin = radius / Math.sin(theta / 2);
        var x = x1 + len_p1_origin * unit_vec_p1_origin[0];
        var y = y1 + len_p1_origin * unit_vec_p1_origin[1];
        var unit_vec_origin_start_tangent = [
          -unit_vec_p1_p0[1],
          unit_vec_p1_p0[0]
        ];
        var unit_vec_origin_end_tangent = [
          unit_vec_p1_p2[1],
          -unit_vec_p1_p2[0]
        ];
        var getAngle = function(vector) {
          var x3 = vector[0];
          var y3 = vector[1];
          if (y3 >= 0) {
            return Math.acos(x3);
          } else {
            return -Math.acos(x3);
          }
        };
        var startAngle = getAngle(unit_vec_origin_start_tangent);
        var endAngle = getAngle(unit_vec_origin_end_tangent);
        this.lineTo(
          x + unit_vec_origin_start_tangent[0] * radius,
          y + unit_vec_origin_start_tangent[1] * radius
        );
        this.arc(x, y, radius, startAngle, endAngle);
      };
      ctx.prototype.stroke = function() {
        if (this.__currentElement.nodeName === "path") {
          this.__currentElement.setAttribute("paint-order", "fill stroke markers");
        }
        this.__applyCurrentDefaultPath();
        this.__applyStyleToCurrentElement("stroke");
      };
      ctx.prototype.fill = function() {
        if (this.__currentElement.nodeName === "path") {
          this.__currentElement.setAttribute("paint-order", "stroke fill markers");
        }
        this.__applyCurrentDefaultPath();
        this.__applyStyleToCurrentElement("fill");
      };
      ctx.prototype.rect = function(x, y, width, height) {
        if (this.__currentElement.nodeName !== "path") {
          this.beginPath();
        }
        this.moveTo(x, y);
        this.lineTo(x + width, y);
        this.lineTo(x + width, y + height);
        this.lineTo(x, y + height);
        this.lineTo(x, y);
        this.closePath();
      };
      ctx.prototype.fillRect = function(x, y, width, height) {
        var rect, parent;
        rect = this.__createElement("rect", {
          x,
          y,
          width,
          height
        }, true);
        parent = this.__closestGroupOrSvg();
        parent.appendChild(rect);
        this.__currentElement = rect;
        this.__applyStyleToCurrentElement("fill");
      };
      ctx.prototype.strokeRect = function(x, y, width, height) {
        var rect, parent;
        rect = this.__createElement("rect", {
          x,
          y,
          width,
          height
        }, true);
        parent = this.__closestGroupOrSvg();
        parent.appendChild(rect);
        this.__currentElement = rect;
        this.__applyStyleToCurrentElement("stroke");
      };
      ctx.prototype.clearRect = function(x, y, width, height) {
        var rect, parent = this.__closestGroupOrSvg();
        rect = this.__createElement("rect", {
          x,
          y,
          width,
          height,
          fill: "#FFFFFF"
        }, true);
        parent.appendChild(rect);
      };
      ctx.prototype.createLinearGradient = function(x1, y1, x2, y2) {
        var grad = this.__createElement("linearGradient", {
          id: randomString(this.__ids),
          x1: x1 + "px",
          x2: x2 + "px",
          y1: y1 + "px",
          y2: y2 + "px",
          "gradientUnits": "userSpaceOnUse"
        }, false);
        this.__defs.appendChild(grad);
        return new CanvasGradient(grad, this);
      };
      ctx.prototype.createRadialGradient = function(x0, y0, r0, x1, y1, r1) {
        var grad = this.__createElement("radialGradient", {
          id: randomString(this.__ids),
          cx: x1 + "px",
          cy: y1 + "px",
          r: r1 + "px",
          fx: x0 + "px",
          fy: y0 + "px",
          "gradientUnits": "userSpaceOnUse"
        }, false);
        this.__defs.appendChild(grad);
        return new CanvasGradient(grad, this);
      };
      ctx.prototype.__parseFont = function() {
        var regex = /^\s*(?=(?:(?:[-a-z]+\s*){0,2}(italic|oblique))?)(?=(?:(?:[-a-z]+\s*){0,2}(small-caps))?)(?=(?:(?:[-a-z]+\s*){0,2}(bold(?:er)?|lighter|[1-9]00))?)(?:(?:normal|\1|\2|\3)\s*){0,3}((?:xx?-)?(?:small|large)|medium|smaller|larger|[.\d]+(?:\%|in|[cem]m|ex|p[ctx]))(?:\s*\/\s*(normal|[.\d]+(?:\%|in|[cem]m|ex|p[ctx])))?\s*([-,\"\sa-z]+?)\s*$/i;
        var fontPart = regex.exec(this.font);
        var data = {
          style: fontPart[1] || "normal",
          size: fontPart[4] || "10px",
          family: fontPart[6] || "sans-serif",
          weight: fontPart[3] || "normal",
          decoration: fontPart[2] || "normal",
          href: null
        };
        if (this.__fontUnderline === "underline") {
          data.decoration = "underline";
        }
        if (this.__fontHref) {
          data.href = this.__fontHref;
        }
        return data;
      };
      ctx.prototype.__wrapTextLink = function(font, element) {
        if (font.href) {
          var a = this.__createElement("a");
          a.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", font.href);
          a.appendChild(element);
          return a;
        }
        return element;
      };
      ctx.prototype.__applyText = function(text, x, y, action) {
        var font = this.__parseFont(), parent = this.__closestGroupOrSvg(), textElement = this.__createElement("text", {
          "font-family": font.family,
          "font-size": font.size,
          "font-style": font.style,
          "font-weight": font.weight,
          "text-decoration": font.decoration,
          "x": x,
          "y": y,
          "text-anchor": getTextAnchor(this.textAlign),
          "dominant-baseline": getDominantBaseline(this.textBaseline)
        }, true);
        textElement.appendChild(this.__document.createTextNode(text));
        this.__currentElement = textElement;
        this.__applyStyleToCurrentElement(action);
        parent.appendChild(this.__wrapTextLink(font, textElement));
      };
      ctx.prototype.fillText = function(text, x, y) {
        this.__applyText(text, x, y, "fill");
      };
      ctx.prototype.strokeText = function(text, x, y) {
        this.__applyText(text, x, y, "stroke");
      };
      ctx.prototype.measureText = function(text) {
        this.__ctx.font = this.font;
        return this.__ctx.measureText(text);
      };
      ctx.prototype.arc = function(x, y, radius, startAngle, endAngle, counterClockwise) {
        if (startAngle === endAngle) {
          return;
        }
        startAngle = startAngle % (2 * Math.PI);
        endAngle = endAngle % (2 * Math.PI);
        if (startAngle === endAngle) {
          endAngle = (endAngle + 2 * Math.PI - 1e-3 * (counterClockwise ? -1 : 1)) % (2 * Math.PI);
        }
        var endX = x + radius * Math.cos(endAngle), endY = y + radius * Math.sin(endAngle), startX = x + radius * Math.cos(startAngle), startY = y + radius * Math.sin(startAngle), sweepFlag = counterClockwise ? 0 : 1, largeArcFlag = 0, diff = endAngle - startAngle;
        if (diff < 0) {
          diff += 2 * Math.PI;
        }
        if (counterClockwise) {
          largeArcFlag = diff > Math.PI ? 0 : 1;
        } else {
          largeArcFlag = diff > Math.PI ? 1 : 0;
        }
        this.lineTo(startX, startY);
        this.__addPathCommand(format(
          "A {rx} {ry} {xAxisRotation} {largeArcFlag} {sweepFlag} {endX} {endY}",
          { rx: radius, ry: radius, xAxisRotation: 0, largeArcFlag, sweepFlag, endX, endY }
        ));
        this.__currentPosition = { x: endX, y: endY };
      };
      ctx.prototype.clip = function() {
        var group = this.__closestGroupOrSvg(), clipPath = this.__createElement("clipPath"), id = randomString(this.__ids), newGroup = this.__createElement("g");
        group.removeChild(this.__currentElement);
        clipPath.setAttribute("id", id);
        clipPath.appendChild(this.__currentElement);
        this.__defs.appendChild(clipPath);
        group.setAttribute("clip-path", format("url(#{id})", { id }));
        group.appendChild(newGroup);
        this.__currentElement = newGroup;
      };
      ctx.prototype.drawImage = function() {
        var args = Array.prototype.slice.call(arguments), image = args[0], dx, dy, dw, dh, sx = 0, sy = 0, sw, sh, parent, svg, defs, group, currentElement, svgImage, canvas, context, id;
        if (args.length === 3) {
          dx = args[1];
          dy = args[2];
          sw = image.width;
          sh = image.height;
          dw = sw;
          dh = sh;
        } else if (args.length === 5) {
          dx = args[1];
          dy = args[2];
          dw = args[3];
          dh = args[4];
          sw = image.width;
          sh = image.height;
        } else if (args.length === 9) {
          sx = args[1];
          sy = args[2];
          sw = args[3];
          sh = args[4];
          dx = args[5];
          dy = args[6];
          dw = args[7];
          dh = args[8];
        } else {
          throw new Error("Inavlid number of arguments passed to drawImage: " + arguments.length);
        }
        parent = this.__closestGroupOrSvg();
        currentElement = this.__currentElement;
        if (image instanceof ctx) {
          svg = image.getSvg();
          defs = svg.childNodes[0];
          while (defs.childNodes.length) {
            id = defs.childNodes[0].getAttribute("id");
            this.__ids[id] = id;
            this.__defs.appendChild(defs.childNodes[0]);
          }
          group = svg.childNodes[1];
          parent.appendChild(group);
          this.__currentElement = group;
          this.translate(dx, dy);
          this.__currentElement = currentElement;
        } else if (image.nodeName === "CANVAS" || image.nodeName === "IMG") {
          svgImage = this.__createElement("image");
          svgImage.setAttribute("width", dw);
          svgImage.setAttribute("height", dh);
          svgImage.setAttribute("preserveAspectRatio", "none");
          if (sx || sy || sw !== image.width || sh !== image.height) {
            canvas = this.__document.createElement("canvas");
            canvas.width = dw;
            canvas.height = dh;
            context = canvas.getContext("2d");
            context.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
            image = canvas;
          }
          svgImage.setAttributeNS(
            "http://www.w3.org/1999/xlink",
            "xlink:href",
            image.nodeName === "CANVAS" ? image.toDataURL() : image.getAttribute("src")
          );
          parent.appendChild(svgImage);
          this.__currentElement = svgImage;
          this.translate(dx, dy);
          this.__currentElement = currentElement;
        }
      };
      ctx.prototype.createPattern = function(image, repetition) {
        var pattern = this.__document.createElementNS("http://www.w3.org/2000/svg", "pattern"), id = randomString(this.__ids), img;
        pattern.setAttribute("id", id);
        pattern.setAttribute("width", image.width);
        pattern.setAttribute("height", image.height);
        if (image.nodeName === "CANVAS" || image.nodeName === "IMG") {
          img = this.__document.createElementNS("http://www.w3.org/2000/svg", "image");
          img.setAttribute("width", image.width);
          img.setAttribute("height", image.height);
          img.setAttributeNS(
            "http://www.w3.org/1999/xlink",
            "xlink:href",
            image.nodeName === "CANVAS" ? image.toDataURL() : image.getAttribute("src")
          );
          pattern.appendChild(img);
          this.__defs.appendChild(pattern);
        } else if (image instanceof ctx) {
          pattern.appendChild(image.__root.childNodes[1]);
          this.__defs.appendChild(pattern);
        }
        return new CanvasPattern(pattern, this);
      };
      ctx.prototype.drawFocusRing = function() {
      };
      ctx.prototype.createImageData = function() {
      };
      ctx.prototype.getImageData = function() {
      };
      ctx.prototype.putImageData = function() {
      };
      ctx.prototype.globalCompositeOperation = function() {
      };
      ctx.prototype.setTransform = function() {
      };
      if (typeof window === "object") {
        window.C2S = ctx;
      }
      if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = ctx;
      }
    })();
  }
});

// app/notices/ray-optics/source/CanvasRenderer.js
var import_canvas2svg, CanvasRenderer, CanvasRenderer_default;
var init_CanvasRenderer = __esm({
  "app/notices/ray-optics/source/CanvasRenderer.js"() {
    "use strict";
    import_canvas2svg = __toESM(require_canvas2svg(), 1);
    CanvasRenderer = class {
      constructor(ctx, origin, scale, lengthScale, backgroundImage, ctxVirtual) {
        this.ctx = ctx;
        this.origin = origin;
        this.scale = scale;
        this.lengthScale = lengthScale;
        this.canvas = ctx.canvas;
        this.backgroundImage = backgroundImage;
        this.ctxVirtual = ctxVirtual;
        if (typeof import_canvas2svg.default !== "undefined" && ctx.constructor === import_canvas2svg.default) {
          this.isSVG = true;
        }
        if (!this.isSVG) {
          this.ctx.setTransform(1, 0, 0, 1, 0, 0);
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          this.ctx.setTransform(this.scale, 0, 0, this.scale, this.origin.x, this.origin.y);
          if (this.ctx.constructor !== import_canvas2svg.default && this.backgroundImage) {
            this.ctx.globalAlpha = 1;
            this.ctx.drawImage(this.backgroundImage, 0, 0);
          }
        }
      }
      /**
       * Converts an RGBA array [R, G, B, A] with values between 0 and 1 to a CSS color string.
       * @param {number[]|object} rgba - The RGBA array or object with r, g, b, a properties.
       * @returns {string} The CSS color string.
       */
      rgbaToCssColor(rgba) {
        if (rgba.r !== void 0) {
          const { r, g, b, a } = rgba;
          return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
        } else {
          const [r, g, b, a] = rgba;
          return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
        }
      }
      /**
       * Draw a point.
       * @param {Point} p
       * @param {number[]|object} [color=[0, 0, 0, 1]]
       * @param {number} [size=5]
       */
      drawPoint(p, color = [0, 0, 0, 1], size = 5) {
        this.ctx.fillStyle = this.rgbaToCssColor(color);
        this.ctx.fillRect(p.x - size / 2 * this.lengthScale, p.y - size / 2 * this.lengthScale, size * this.lengthScale, size * this.lengthScale);
      }
      /**
       * Draw a line.
       * @param {Line} l
       * @param {number[]|object} [color=[0, 0, 0, 1]]
       * @param {boolean} [showArrow=false] (not implemented, just for parameter consistency)
       * @param {number[]} [lineDash=[]]
       * @param {number} [lineWidth=1]
       */
      drawLine(l, color = [0, 0, 0, 1], showArrow = false, lineDash = [], lineWidth = 1) {
        this.ctx.setLineDash(lineDash.map((value) => value * this.lengthScale));
        this.ctx.strokeStyle = this.rgbaToCssColor(color);
        this.ctx.lineWidth = lineWidth * this.lengthScale;
        this.ctx.beginPath();
        let ang1 = Math.atan2(l.p2.x - l.p1.x, l.p2.y - l.p1.y);
        let cvsLimit = (Math.abs(l.p1.x + this.origin.x) + Math.abs(l.p1.y + this.origin.y) + this.canvas.height + this.canvas.width) / Math.min(1, this.scale);
        this.ctx.moveTo(l.p1.x - Math.sin(ang1) * cvsLimit, l.p1.y - Math.cos(ang1) * cvsLimit);
        this.ctx.lineTo(l.p1.x + Math.sin(ang1) * cvsLimit, l.p1.y + Math.cos(ang1) * cvsLimit);
        this.ctx.stroke();
      }
      /**
       * Draw a ray.
       * @param {Line} r
       * @param {number[]|object} [color=[0, 0, 0, 1]]
       * @param {boolean} [showArrow=true]
       * @param {number[]} [lineDash=[]]
       * @param {number} [lineWidth=1]
       */
      drawRay(r, color = [0, 0, 0, 1], showArrow = false, lineDash = [], lineWidth = 1) {
        this.ctx.setLineDash(lineDash.map((value) => value * this.lengthScale));
        this.ctx.strokeStyle = this.rgbaToCssColor(color);
        this.ctx.lineWidth = lineWidth * this.lengthScale;
        this.ctx.fillStyle = this.rgbaToCssColor(color);
        if (Math.abs(r.p2.x - r.p1.x) <= 1e-5 * this.lengthScale && Math.abs(r.p2.y - r.p1.y) <= 1e-5 * this.lengthScale) {
          return;
        }
        const dx = r.p2.x - r.p1.x;
        const dy = r.p2.y - r.p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / length;
        const unitY = dy / length;
        const cvsLimit = (Math.abs(r.p1.x + this.origin.x) + Math.abs(r.p1.y + this.origin.y) + this.canvas.height + this.canvas.width) / Math.min(1, this.scale);
        const arrowSize = 5 * this.lengthScale;
        const arrowDistance = 150 * this.lengthScale;
        if (!showArrow || arrowSize < this.ctx.lineWidth * 1.2) {
          this.ctx.beginPath();
          this.ctx.moveTo(r.p1.x, r.p1.y);
          this.ctx.lineTo(r.p1.x + unitX * cvsLimit, r.p1.y + unitY * cvsLimit);
          this.ctx.stroke();
          return;
        }
        this.ctx.beginPath();
        this.ctx.moveTo(r.p1.x, r.p1.y);
        this.ctx.lineTo(r.p1.x + unitX * arrowDistance, r.p1.y + unitY * arrowDistance);
        this.ctx.stroke();
        const arrowX = r.p1.x + unitX * arrowDistance;
        const arrowY = r.p1.y + unitY * arrowDistance;
        const baseWidth = this.ctx.lineWidth;
        const tipWidth = arrowSize;
        const perpX = -unitY;
        const perpY = unitX;
        this.ctx.beginPath();
        this.ctx.moveTo(
          arrowX - tipWidth / 2 * perpX,
          arrowY - tipWidth / 2 * perpY
        );
        this.ctx.lineTo(
          arrowX + tipWidth / 2 * perpX,
          arrowY + tipWidth / 2 * perpY
        );
        this.ctx.lineTo(
          arrowX + arrowSize * unitX + baseWidth / 2 * perpX,
          arrowY + arrowSize * unitY + baseWidth / 2 * perpY
        );
        this.ctx.lineTo(
          arrowX + arrowSize * unitX - baseWidth / 2 * perpX,
          arrowY + arrowSize * unitY - baseWidth / 2 * perpY
        );
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.moveTo(arrowX + arrowSize * unitX, arrowY + arrowSize * unitY);
        this.ctx.lineTo(r.p1.x + unitX * cvsLimit, r.p1.y + unitY * cvsLimit);
        this.ctx.stroke();
      }
      /**
       * Draw a segment.
       * @param {Line} s
       * @param {number[]|object} [color=[0, 0, 0, 1]]
       * @param {boolean} [showArrow=true]
       * @param {number[]} [lineDash=[]]
       * @param {number} [lineWidth=1]
       */
      drawSegment(s, color = [0, 0, 0, 1], showArrow = false, lineDash = [], lineWidth = 1) {
        this.ctx.setLineDash(lineDash.map((value) => value * this.lengthScale));
        this.ctx.strokeStyle = this.rgbaToCssColor(color);
        this.ctx.lineWidth = lineWidth * this.lengthScale;
        this.ctx.fillStyle = this.rgbaToCssColor(color);
        const dx = s.p2.x - s.p1.x;
        const dy = s.p2.y - s.p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const arrowSize = Math.min(length * 0.15, 5 * this.lengthScale);
        const arrowPosition = 0.67;
        if (!showArrow || arrowSize < this.ctx.lineWidth * 1.2) {
          this.ctx.beginPath();
          this.ctx.moveTo(s.p1.x, s.p1.y);
          this.ctx.lineTo(s.p2.x, s.p2.y);
          this.ctx.stroke();
          return;
        }
        const unitX = dx / length;
        const unitY = dy / length;
        const arrowX = s.p1.x + dx * arrowPosition;
        const arrowY = s.p1.y + dy * arrowPosition;
        this.ctx.beginPath();
        this.ctx.moveTo(s.p1.x, s.p1.y);
        this.ctx.lineTo(arrowX - arrowSize / 2 * unitX, arrowY - arrowSize / 2 * unitY);
        this.ctx.stroke();
        const baseWidth = this.ctx.lineWidth;
        const tipWidth = arrowSize;
        const perpX = -unitY;
        const perpY = unitX;
        this.ctx.beginPath();
        this.ctx.moveTo(
          arrowX - arrowSize / 2 * unitX - tipWidth / 2 * perpX,
          arrowY - arrowSize / 2 * unitY - tipWidth / 2 * perpY
        );
        this.ctx.lineTo(
          arrowX - arrowSize / 2 * unitX + tipWidth / 2 * perpX,
          arrowY - arrowSize / 2 * unitY + tipWidth / 2 * perpY
        );
        this.ctx.lineTo(
          arrowX + arrowSize / 2 * unitX + baseWidth / 2 * perpX,
          arrowY + arrowSize / 2 * unitY + baseWidth / 2 * perpY
        );
        this.ctx.lineTo(
          arrowX + arrowSize / 2 * unitX - baseWidth / 2 * perpX,
          arrowY + arrowSize / 2 * unitY - baseWidth / 2 * perpY
        );
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.moveTo(arrowX + arrowSize / 2 * unitX, arrowY + arrowSize / 2 * unitY);
        this.ctx.lineTo(s.p2.x, s.p2.y);
        this.ctx.stroke();
      }
      /**
       * Draw a circle.
       * @param {Circle} c
       * @param {String|object} [color='black']
       */
      drawCircle(c, color = "black") {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1 * this.lengthScale;
        this.ctx.beginPath();
        if (typeof c.r === "object") {
          let dx = c.r.p1.x - c.r.p2.x;
          let dy = c.r.p1.y - c.r.p2.y;
          this.ctx.arc(c.c.x, c.c.y, Math.sqrt(dx * dx + dy * dy), 0, Math.PI * 2, false);
        } else {
          this.ctx.arc(c.c.x, c.c.y, c.r, 0, Math.PI * 2, false);
        }
        this.ctx.stroke();
      }
      /**
       * Apply color transformation to simulate 'lighter' composition with less color saturation.
       */
      applyColorTransformation() {
        this.ctxVirtual.canvas.width = this.canvas.width;
        this.ctxVirtual.canvas.height = this.canvas.height;
        this.ctxVirtual.drawImage(this.canvas, 0, 0);
        const imageData = this.ctxVirtual.getImageData(0, 0, this.ctxVirtual.canvas.width, this.ctxVirtual.canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;
          const a0 = data[i + 3] / 256;
          const R = -Math.log(1 - data[i] / 256) * a0;
          const G = -Math.log(1 - data[i + 1] / 256) * a0;
          const B = -Math.log(1 - data[i + 2] / 256) * a0;
          const factor = Math.max(R, G, B);
          data[i] = 255 * R / factor;
          data[i + 1] = 255 * G / factor;
          data[i + 2] = 255 * B / factor;
          data[i + 3] = 255 * Math.min(factor, 1);
        }
        this.ctxVirtual.putImageData(imageData, 0, 0);
        this.ctx.globalCompositeOperation = "source-over";
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.ctxVirtual.canvas, 0, 0);
      }
    };
    CanvasRenderer_default = CanvasRenderer;
  }
});

// app/notices/ray-optics/source/FloatColorRenderer.js
var FloatColorRenderer, FloatColorRenderer_default;
var init_FloatColorRenderer = __esm({
  "app/notices/ray-optics/source/FloatColorRenderer.js"() {
    "use strict";
    FloatColorRenderer = class _FloatColorRenderer {
      /**
       * Maximum number of elements in the cache before flushing.
       * @type {number}
       */
      static MAX_CACHE_SIZE = 500;
      constructor(gl, origin, scale, lengthScale, backgroundImage, ctxVirtual, colorMode) {
        this.gl = gl;
        if (!this.gl) {
          throw new Error("Unable to initialize WebGL. Your browser may not support it.");
        }
        const ext = this.gl.getExtension("OES_texture_float");
        if (!ext) {
          throw new Error("OES_texture_float not supported");
        }
        this.canvas = gl.canvas;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.origin = origin;
        this.scale = scale;
        this.lengthScale = lengthScale;
        this.colorMode = colorMode;
        this.rayCache = [];
        this.segmentCache = [];
        this.pointCache = [];
        this.arrowCache = [];
        this.hasFirstFlush = false;
        switch (this.colorMode) {
          case "colorizedIntensity":
            this.msaaCount = 1;
            break;
          default:
            this.msaaCount = 4;
        }
        this.lineBuffer = this.gl.createBuffer();
        this.pointBuffer = this.gl.createBuffer();
        this.arrowBuffer = this.gl.createBuffer();
        this.initializeShaders();
        this.initializeFramebuffer();
      }
      /**
       * Initialize the framebuffer and textures.
       */
      initializeFramebuffer() {
        const gl = this.gl;
        this.floatTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.floatTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.floatTexture, 0);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error("Framebuffer is not complete: " + status);
        }
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          -1,
          -1,
          1,
          -1,
          -1,
          1,
          1,
          1
        ]), gl.STATIC_DRAW);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      }
      /**
       * Initialize shaders.
       */
      initializeShaders() {
        const rayVertexSource = `
      attribute vec2 position;
      uniform vec2 u_resolution;
      uniform vec2 u_origin;
      uniform float u_scale;
      uniform bool u_isScreenSpace;
      
      varying vec2 v_position;
      varying vec2 v_resolution;
      
      void main() {
        vec2 pos;
        if (u_isScreenSpace) {
          pos = position;
        } else {
          pos = position * u_scale + u_origin;
        }
        
        // Convert to clip space
        vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
        clipSpace.y = -clipSpace.y;
        gl_Position = vec4(clipSpace, 0.0, 1.0);
        
        // Pass values to fragment shader
        v_position = pos;
        v_resolution = u_resolution;
      }
    `;
        const rayFragmentSource = `
      precision highp float;
      uniform vec4 u_color;
      uniform bool u_isScreenSpace;
      
      varying vec2 v_position;
      varying vec2 v_resolution;
      
      void main() {
        gl_FragColor = u_color;
      }
    `;
        const pointVertexSource = `
      attribute vec2 position;
      uniform vec2 u_resolution;
      uniform vec2 u_origin;
      uniform float u_scale;
      uniform vec2 u_point;
      uniform float u_size;
      
      varying vec2 v_position;
      varying vec2 v_resolution;
      
      void main() {
        // Calculate point position
        vec2 pointPos = u_point * u_scale + u_origin;
        vec2 pos = pointPos + position * u_size * u_scale;
        
        // Convert to clip space
        vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
        clipSpace.y = -clipSpace.y;
        gl_Position = vec4(clipSpace, 0.0, 1.0);
        
        // Pass values to fragment shader
        v_position = pos;
        v_resolution = u_resolution;
      }
    `;
        const pointFragmentSource = rayFragmentSource;
        const quadVertexSource = `
      attribute vec2 position;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        v_texCoord = position * 0.5 + 0.5;
      }
    `;
        let quadFragmentSource;
        switch (this.colorMode) {
          case "linear":
            quadFragmentSource = `
          precision highp float;
          uniform sampler2D u_texture;
          varying vec2 v_texCoord;

          void main() {
            vec4 color = texture2D(u_texture, v_texCoord);
            float maxComponent = max(max(color.r, color.g), color.b);
            if (maxComponent > 1.0) {
              color.rgb /= maxComponent;
            }
            gl_FragColor = vec4(pow(color.rgb, vec3(1.0 / 2.2)), pow(min(maxComponent, 1.0), 1.0 / 2.2));
          }
        `;
            break;
          case "linearRGB":
            quadFragmentSource = `
          precision highp float;
          uniform sampler2D u_texture;
          varying vec2 v_texCoord;

          void main() {
            vec4 color = texture2D(u_texture, v_texCoord);
            float maxComponent = max(max(color.r, color.g), color.b);
            gl_FragColor = vec4(pow(color.rgb, vec3(1.0 / 2.2)), pow(maxComponent, 1.0 / 2.2));
          }
        `;
            break;
          case "reinhard":
            quadFragmentSource = `
          precision highp float;

          uniform sampler2D u_texture;
          varying vec2 v_texCoord;

          // Convert RGB to luminance using perceptual weights
          float getLuminance(vec3 color) {
            return dot(color, vec3(0.2126, 0.7152, 0.0722));
          }

          void main() {
            // Sample the texture
            vec4 color = texture2D(u_texture, v_texCoord);

            // Calculate luminance
            float Lold = getLuminance(color.rgb);

            // Lnew / Lold simplifies to 1 / (1 + Lold).  Use the simplified
            // form so a black pixel does not evaluate the undefined 0 / 0.
            vec3 toneMapped = color.rgb / (1.0 + Lold);

            // Apply gamma correction
            vec3 gammaCorrected = pow(toneMapped, vec3(1.0 / 2.2));

            // Store the maximum component of the original color
            float maxComponent = max(max(color.r, color.g), color.b);

            gl_FragColor = vec4(gammaCorrected, pow(maxComponent, 1.0 / 2.2));
          }
        `;
            break;
          case "colorizedIntensity":
            quadFragmentSource = `
          precision highp float;
          uniform sampler2D u_texture;
          varying vec2 v_texCoord;

          vec4 brightnessToColor(float brightness) {
              if (brightness > 100.0) {
                  return vec4(1.0, 0.0, 0.0, 1.0); // Red
              } else if (brightness > 10.0) {
                  return vec4(mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.0, 0.0), (log2(brightness) - log2(10.0)) / (log2(100.0) - log2(10.0))), 1.0); // Smooth transition from orange to red
              } else if (brightness > 1.0) {
                  return vec4(mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.5, 0.0), (log2(brightness) - log2(1.0)) / (log2(10.0) - log2(1.0))), 1.0); // Smooth transition from yellow to orange
              } else if (brightness > 0.1) {
                  return vec4(mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (log2(brightness) - log2(0.1)) / (log2(1.0) - log2(0.1))), 1.0); // Smooth transition from green to yellow
              } else if (brightness > 0.01) {
                  return vec4(mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (log2(brightness) - log2(0.01)) / (log2(0.1) - log2(0.01))), 1.0); // Smooth transition from cyan to green
              } else if (brightness > 0.001) {
                  return vec4(mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), (log2(brightness) - log2(0.001)) / (log2(0.01) - log2(0.001))), 1.0); // Smooth transition from blue to cyan
              } else if (brightness > 0.0001) {
                  return vec4(mix(vec3(0.3, 0.0, 0.3), vec3(0.0, 0.0, 1.0), (log2(brightness) - log2(0.0001)) / (log2(0.001) - log2(0.0001))), 1.0); // Smooth transition from purple to blue
              } else {
                  return vec4(mix(vec3(0.0, 0.0, 0.0), vec3(0.3, 0.0, 0.3), (log2(max(brightness, 1e-7)) - log2(1e-7)) / (log2(0.0001) - log2(1e-7))), (log2(max(brightness, 1e-7)) - log2(1e-7)) / (log2(0.0001) - log2(1e-7))); // Smooth transition from purple to transparent
              }
          }

          void main() {
              vec4 color = texture2D(u_texture, v_texCoord);
              float maxComponent = max(max(color.r, color.g), color.b);

              vec4 mappedColor = brightnessToColor(maxComponent);
              gl_FragColor = vec4(mappedColor.rgb * 0.8, 0.0);
          }
        `;
            break;
        }
        const rayVertexShader = this.compileShader(this.gl, rayVertexSource, this.gl.VERTEX_SHADER);
        const rayFragmentShader = this.compileShader(this.gl, rayFragmentSource, this.gl.FRAGMENT_SHADER);
        this.rayProgram = this.gl.createProgram();
        this.gl.attachShader(this.rayProgram, rayVertexShader);
        this.gl.attachShader(this.rayProgram, rayFragmentShader);
        this.gl.linkProgram(this.rayProgram);
        if (!this.gl.getProgramParameter(this.rayProgram, this.gl.LINK_STATUS)) {
          this.gl.deleteProgram(this.rayProgram);
          return;
        }
        this.positionAttributeLocation = this.gl.getAttribLocation(this.rayProgram, "position");
        this.resolutionUniformLocation = this.gl.getUniformLocation(this.rayProgram, "u_resolution");
        this.originUniformLocation = this.gl.getUniformLocation(this.rayProgram, "u_origin");
        this.scaleUniformLocation = this.gl.getUniformLocation(this.rayProgram, "u_scale");
        this.isScreenSpaceLocation = this.gl.getUniformLocation(this.rayProgram, "u_isScreenSpace");
        this.colorUniformLocation = this.gl.getUniformLocation(this.rayProgram, "u_color");
        const pointVertexShader = this.compileShader(this.gl, pointVertexSource, this.gl.VERTEX_SHADER);
        const pointFragmentShader = this.compileShader(this.gl, pointFragmentSource, this.gl.FRAGMENT_SHADER);
        this.pointProgram = this.gl.createProgram();
        this.gl.attachShader(this.pointProgram, pointVertexShader);
        this.gl.attachShader(this.pointProgram, pointFragmentShader);
        this.gl.linkProgram(this.pointProgram);
        if (!this.gl.getProgramParameter(this.pointProgram, this.gl.LINK_STATUS)) {
          this.gl.deleteProgram(this.pointProgram);
          return;
        }
        this.pointPositionAttributeLocation = this.gl.getAttribLocation(this.pointProgram, "position");
        this.pointResolutionUniformLocation = this.gl.getUniformLocation(this.pointProgram, "u_resolution");
        this.pointOriginUniformLocation = this.gl.getUniformLocation(this.pointProgram, "u_origin");
        this.pointScaleUniformLocation = this.gl.getUniformLocation(this.pointProgram, "u_scale");
        this.pointPositionUniformLocation = this.gl.getUniformLocation(this.pointProgram, "u_point");
        this.pointSizeUniformLocation = this.gl.getUniformLocation(this.pointProgram, "u_size");
        this.pointColorUniformLocation = this.gl.getUniformLocation(this.pointProgram, "u_color");
        const quadVertexShader = this.compileShader(this.gl, quadVertexSource, this.gl.VERTEX_SHADER);
        const quadFragmentShader = this.compileShader(this.gl, quadFragmentSource, this.gl.FRAGMENT_SHADER);
        this.quadProgram = this.gl.createProgram();
        this.gl.attachShader(this.quadProgram, quadVertexShader);
        this.gl.attachShader(this.quadProgram, quadFragmentShader);
        this.gl.linkProgram(this.quadProgram);
        if (!this.gl.getProgramParameter(this.quadProgram, this.gl.LINK_STATUS)) {
          this.gl.deleteProgram(this.quadProgram);
          return;
        }
        this.quadPositionLocation = this.gl.getAttribLocation(this.quadProgram, "position");
        this.textureLocation = this.gl.getUniformLocation(this.quadProgram, "u_texture");
        const pointVertices = new Float32Array([
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          0.5
        ]);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, pointVertices, this.gl.STATIC_DRAW);
      }
      /**
       * Compile a shader.
       * @param {WebGLRenderingContext} gl
       * @param {string} source
       * @param {number} type
       * @returns {WebGLShader}
       */
      compileShader(gl, source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      }
      /**
       * Begin the drawing process.
       * This method is called at the beginning of each frame.
       */
      begin() {
        this.rayCache = [];
        this.segmentCache = [];
        this.pointCache = [];
        this.arrowCache = [];
        this.hasFirstFlush = false;
      }
      /**
       * Draw a point.
       * @param {Point} p
       * @param {number[]} [color=[0, 0, 0, 1]]
       * @param {number} [size=5]
       */
      drawPoint(p, color = [0, 0, 0, 1], size = 5) {
        color = this.preprocessColor(color);
        this.pointCache.push({ p, color, size });
        if (this.pointCache.length >= _FloatColorRenderer.MAX_CACHE_SIZE) {
          this.flush();
        }
      }
      /**
       * Draw a ray.
       * @param {Line} r
       * @param {number[]} [color=[0, 0, 0, 1]]
       * @param {boolean} [showArrow=false]
       * @param {number[]} [lineDash=[]]
       */
      drawRay(r, color = [0, 0, 0, 1], showArrow = false, lineDash = []) {
        const dx = r.p2.x - r.p1.x;
        const dy = r.p2.y - r.p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 1e-5 * this.lengthScale) {
          return;
        }
        color = this.preprocessColor(color);
        const unitX = dx / length;
        const unitY = dy / length;
        const cvsLimit = (Math.abs(r.p1.x + this.origin.x) + Math.abs(r.p1.y + this.origin.y) + this.canvas.height + this.canvas.width) / Math.min(1, this.scale);
        const arrowSize = 5 * this.lengthScale;
        const arrowDistance = 150 * this.lengthScale;
        if (showArrow && arrowSize >= this.lengthScale * 1.2) {
          const firstSegment = {
            p1: r.p1,
            p2: {
              x: r.p1.x + unitX * arrowDistance,
              y: r.p1.y + unitY * arrowDistance
            }
          };
          if (lineDash && lineDash.length > 0) {
            this.drawDashedSegment(firstSegment, color, lineDash);
          } else {
            this.segmentCache.push({ s: firstSegment, color });
          }
          const arrowX = r.p1.x + unitX * arrowDistance;
          const arrowY = r.p1.y + unitY * arrowDistance;
          const perpX = -unitY;
          const perpY = unitX;
          const baseWidth = this.lengthScale;
          const tipWidth = arrowSize;
          this.arrowCache.push({
            points: [
              // Front points (wide part)
              arrowX - tipWidth / 2 * perpX,
              arrowY - tipWidth / 2 * perpY,
              arrowX + tipWidth / 2 * perpX,
              arrowY + tipWidth / 2 * perpY,
              // Back points (narrow part)
              arrowX + arrowSize * unitX + baseWidth / 2 * perpX,
              arrowY + arrowSize * unitY + baseWidth / 2 * perpY,
              arrowX + arrowSize * unitX - baseWidth / 2 * perpX,
              arrowY + arrowSize * unitY - baseWidth / 2 * perpY
            ],
            color
          });
          const secondRay = {
            p1: {
              x: arrowX + arrowSize * unitX,
              y: arrowY + arrowSize * unitY
            },
            p2: {
              x: r.p1.x + unitX * cvsLimit,
              y: r.p1.y + unitY * cvsLimit
            }
          };
          if (lineDash && lineDash.length > 0) {
            this.drawDashedSegment(secondRay, color, lineDash);
          } else {
            this.rayCache.push({ r: secondRay, color });
          }
        } else {
          if (lineDash && lineDash.length > 0) {
            let dashPos = 0;
            let isDraw = true;
            let currentPos = 0;
            while (currentPos < cvsLimit) {
              const dashLength = lineDash[dashPos] * this.lengthScale;
              if (isDraw) {
                const segStart = {
                  x: r.p1.x + currentPos * unitX,
                  y: r.p1.y + currentPos * unitY
                };
                const segEnd = {
                  x: r.p1.x + Math.min(currentPos + dashLength, cvsLimit) * unitX,
                  y: r.p1.y + Math.min(currentPos + dashLength, cvsLimit) * unitY
                };
                this.segmentCache.push({
                  s: { p1: segStart, p2: segEnd },
                  color
                });
              }
              currentPos += dashLength;
              dashPos = (dashPos + 1) % lineDash.length;
              isDraw = !isDraw;
            }
          } else if (this.msaaCount > 1) {
            const subpixelOffset = 1 / this.msaaCount;
            const perpX = -unitY;
            const perpY = unitX;
            const dividedColor = [color[0], color[1], color[2], color[3] / this.msaaCount];
            for (let i = 0; i < this.msaaCount; i++) {
              const offset = (i % 2 === 0 ? 1 : -1) * (Math.floor(i / 2) + 0.5) * subpixelOffset / this.scale;
              const subpixelRay = {
                p1: {
                  x: r.p1.x + offset * perpX,
                  y: r.p1.y + offset * perpY
                },
                p2: {
                  x: r.p1.x + unitX * cvsLimit + offset * perpX,
                  y: r.p1.y + unitY * cvsLimit + offset * perpY
                }
              };
              this.rayCache.push({ r: subpixelRay, color: dividedColor });
            }
          } else {
            this.rayCache.push({ r, color });
          }
        }
        if (this.rayCache.length >= _FloatColorRenderer.MAX_CACHE_SIZE || this.segmentCache.length >= _FloatColorRenderer.MAX_CACHE_SIZE || this.arrowCache.length >= _FloatColorRenderer.MAX_CACHE_SIZE) {
          this.flush();
        }
      }
      /**
       * Draw a dashed segment.
       * @param {Line} s
       * @param {number[]} [color=[0, 0, 0, 1]]
       * @param {number[]} [lineDash=[]]
       */
      drawDashedSegment(s, color, lineDash) {
        const dx = s.p2.x - s.p1.x;
        const dy = s.p2.y - s.p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 1e-5 * this.lengthScale) {
          return;
        }
        const unitX = dx / length;
        const unitY = dy / length;
        let dashPos = 0;
        let isDraw = true;
        let currentPos = 0;
        while (currentPos < length) {
          const dashLength = lineDash[dashPos] * this.lengthScale;
          const remainingLength = length - currentPos;
          if (isDraw) {
            const segStart = {
              x: s.p1.x + currentPos * unitX,
              y: s.p1.y + currentPos * unitY
            };
            const segEnd = {
              x: s.p1.x + Math.min(currentPos + dashLength, length) * unitX,
              y: s.p1.y + Math.min(currentPos + dashLength, length) * unitY
            };
            this.segmentCache.push({
              s: { p1: segStart, p2: segEnd },
              color
            });
          }
          currentPos += dashLength;
          dashPos = (dashPos + 1) % lineDash.length;
          isDraw = !isDraw;
          if (currentPos >= length) break;
        }
      }
      /**
       * Draw a segment.
       * @param {Line} s
       * @param {number[]} [color=[0, 0, 0, 1]]
       * @param {boolean} [showArrow=false]
       * @param {number[]} [lineDash=[]]
       */
      drawSegment(s, color = [0, 0, 0, 1], showArrow = false, lineDash = []) {
        const dx = s.p2.x - s.p1.x;
        const dy = s.p2.y - s.p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / length;
        const unitY = dy / length;
        if (length < 1e-5 * this.lengthScale) {
          return;
        }
        color = this.preprocessColor(color);
        const arrowSize = Math.min(length * 0.15, 5 * this.lengthScale);
        const arrowPosition = 0.67;
        if (showArrow && arrowSize >= this.lengthScale * 1.2) {
          const arrowX = s.p1.x + dx * arrowPosition;
          const arrowY = s.p1.y + dy * arrowPosition;
          const firstSegment = {
            p1: s.p1,
            p2: {
              x: arrowX - arrowSize / 2 * unitX,
              y: arrowY - arrowSize / 2 * unitY
            }
          };
          if (lineDash && lineDash.length > 0) {
            this.drawDashedSegment(firstSegment, color, lineDash);
          } else {
            this.segmentCache.push({ s: firstSegment, color });
          }
          const perpX = -unitY;
          const perpY = unitX;
          const baseWidth = this.lengthScale;
          const tipWidth = arrowSize;
          this.arrowCache.push({
            points: [
              // Front points (wide part)
              arrowX - arrowSize / 2 * unitX - tipWidth / 2 * perpX,
              arrowY - arrowSize / 2 * unitY - tipWidth / 2 * perpY,
              arrowX - arrowSize / 2 * unitX + tipWidth / 2 * perpX,
              arrowY - arrowSize / 2 * unitY + tipWidth / 2 * perpY,
              // Back points (narrow part)
              arrowX + arrowSize / 2 * unitX + baseWidth / 2 * perpX,
              arrowY + arrowSize / 2 * unitY + baseWidth / 2 * perpY,
              arrowX + arrowSize / 2 * unitX - baseWidth / 2 * perpX,
              arrowY + arrowSize / 2 * unitY - baseWidth / 2 * perpY
            ],
            color
          });
          const secondSegment = {
            p1: {
              x: arrowX + arrowSize / 2 * unitX,
              y: arrowY + arrowSize / 2 * unitY
            },
            p2: s.p2
          };
          if (lineDash && lineDash.length > 0) {
            this.drawDashedSegment(secondSegment, color, lineDash);
          } else {
            this.segmentCache.push({ s: secondSegment, color });
          }
        } else {
          if (lineDash && lineDash.length > 0) {
            this.drawDashedSegment(s, color, lineDash);
          } else if (this.msaaCount > 1) {
            const subpixelOffset = 1 / this.msaaCount;
            const perpX = -unitY;
            const perpY = unitX;
            const dividedColor = [color[0], color[1], color[2], color[3] / this.msaaCount];
            for (let i = 0; i < this.msaaCount; i++) {
              const offset = (i % 2 === 0 ? 1 : -1) * (Math.floor(i / 2) + 0.5) * subpixelOffset / this.scale;
              const subpixelSegment = {
                p1: {
                  x: s.p1.x + offset * perpX,
                  y: s.p1.y + offset * perpY
                },
                p2: {
                  x: s.p2.x + offset * perpX,
                  y: s.p2.y + offset * perpY
                }
              };
              this.segmentCache.push({ s: subpixelSegment, color: dividedColor });
            }
          } else {
            this.segmentCache.push({ s, color });
          }
        }
        if (this.segmentCache.length >= _FloatColorRenderer.MAX_CACHE_SIZE || this.arrowCache.length >= _FloatColorRenderer.MAX_CACHE_SIZE) {
          this.flush();
        }
      }
      /**
       * Flush the caches and render the accumulated rays, segments, and points.
       * This method is called when the cache size exceeds the maximum cache size, when the simulation is paused, or when the simulation is completed.
       */
      flush() {
        if (!this.rayProgram || !this.quadProgram || !this.pointProgram) {
          return;
        }
        const gl = this.gl;
        const canvas = gl.canvas;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, canvas.width, canvas.height);
        if (!this.hasFirstFlush) {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          this.hasFirstFlush = true;
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        if (this.pointCache.length > 0) {
          gl.useProgram(this.pointProgram);
          gl.uniform2f(this.pointResolutionUniformLocation, canvas.width, canvas.height);
          gl.uniform2f(this.pointOriginUniformLocation, this.origin.x, this.origin.y);
          gl.uniform1f(this.pointScaleUniformLocation, this.scale);
          gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer);
          gl.enableVertexAttribArray(this.pointPositionAttributeLocation);
          gl.vertexAttribPointer(this.pointPositionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
          this.pointCache.forEach(({ p, color, size }) => {
            const [r, g, b, a] = color;
            gl.uniform2f(this.pointPositionUniformLocation, p.x, p.y);
            gl.uniform1f(this.pointSizeUniformLocation, size * this.lengthScale);
            gl.uniform4f(this.pointColorUniformLocation, r * a, g * a, b * a, 1);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          });
        }
        gl.useProgram(this.rayProgram);
        gl.uniform2f(this.resolutionUniformLocation, canvas.width, canvas.height);
        gl.uniform2f(this.originUniformLocation, this.origin.x, this.origin.y);
        gl.uniform1f(this.scaleUniformLocation, this.scale);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
        gl.enableVertexAttribArray(this.positionAttributeLocation);
        gl.vertexAttribPointer(this.positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1i(this.isScreenSpaceLocation, false);
        this.rayCache.forEach(({ r, color }) => {
          const [r_, g, b, a] = color;
          gl.uniform4f(this.colorUniformLocation, r_ * a, g * a, b * a, 1);
          const cvsLimit = (Math.abs(r.p1.x + this.origin.x) + Math.abs(r.p1.y + this.origin.y) + this.canvas.height + this.canvas.width) / Math.min(1, this.scale);
          const rayEnd = {
            x: r.p1.x + (r.p2.x - r.p1.x) * cvsLimit,
            y: r.p1.y + (r.p2.y - r.p1.y) * cvsLimit
          };
          const vertices = this.createRectangleFromLine(r.p1, rayEnd);
          gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        });
        this.segmentCache.forEach(({ s, color }) => {
          const [r_, g, b, a] = color;
          gl.uniform4f(this.colorUniformLocation, r_ * a, g * a, b * a, 1);
          const vertices = this.createRectangleFromLine(s.p1, s.p2);
          gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        });
        if (this.arrowCache.length > 0) {
          gl.useProgram(this.rayProgram);
          gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowBuffer);
          gl.enableVertexAttribArray(this.positionAttributeLocation);
          gl.vertexAttribPointer(this.positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
          this.arrowCache.forEach(({ points, color }) => {
            const [r, g, b, a] = color;
            gl.uniform4f(this.colorUniformLocation, r * a, g * a, b * a, 1);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
          });
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.BLEND);
        gl.useProgram(this.quadProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.floatTexture);
        gl.uniform1i(this.textureLocation, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(this.quadPositionLocation);
        gl.vertexAttribPointer(this.quadPositionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        this.rayCache.length = 0;
        this.segmentCache.length = 0;
        this.pointCache.length = 0;
        this.arrowCache.length = 0;
      }
      /**
       * Create a rectangle from a line segment. Since WebGL lineWidth is not widely supported, this method creates a rectangle with the given width to render the line segment or ray.
       * @param {Point} p1
       * @param {Point} p2
       * @param {number} [width=1]
       */
      createRectangleFromLine(p1, p2, width = 1) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 1e-5 * this.lengthScale) {
          return new Float32Array(0);
        }
        const unitX = dx / length;
        const unitY = dy / length;
        const perpX = -unitY * (width * this.lengthScale / 2);
        const perpY = unitX * (width * this.lengthScale / 2);
        return new Float32Array([
          // First triangle
          p1.x + perpX,
          p1.y + perpY,
          p1.x - perpX,
          p1.y - perpY,
          p2.x + perpX,
          p2.y + perpY,
          // Second triangle
          p2.x + perpX,
          p2.y + perpY,
          p1.x - perpX,
          p1.y - perpY,
          p2.x - perpX,
          p2.y - perpY
        ]);
      }
      /**
       * Preprocess color for gamma correction and normalization.
       * @param {number[]} color
       * @returns {number[]}
       */
      preprocessColor(color) {
        const r = color[0] * color[3];
        const g = color[1] * color[3];
        const b = color[2] * color[3];
        if (r + g + b == 0) {
          return [0, 0, 0, 0];
        }
        const m = Math.max(r, g, b);
        switch (this.colorMode) {
          case "colorizedIntensity":
            return [m, m, m, 1];
          default:
            const rr = Math.pow(r, 2.2);
            const gg = Math.pow(g, 2.2);
            const bb = Math.pow(b, 2.2);
            const ratio = m / Math.max(rr, gg, bb);
            return [rr * ratio, gg * ratio, bb * ratio, 1];
        }
      }
      /**
       * Destroy the renderer and release resources.
       */
      destroy() {
        const gl = this.gl;
        gl.deleteBuffer(this.lineBuffer);
        gl.deleteBuffer(this.pointBuffer);
        gl.deleteBuffer(this.arrowBuffer);
        gl.deleteBuffer(this.quadBuffer);
        gl.deleteTexture(this.floatTexture);
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteProgram(this.rayProgram);
        gl.deleteProgram(this.pointProgram);
        gl.deleteProgram(this.quadProgram);
      }
      applyColorTransformation() {
      }
    };
    FloatColorRenderer_default = FloatColorRenderer;
  }
});

// app/notices/ray-optics/source/formula/dag-builder.js
var DagBuilder;
var init_dag_builder = __esm({
  "app/notices/ray-optics/source/formula/dag-builder.js"() {
    "use strict";
    DagBuilder = class {
      constructor() {
        this.nodes = [];
        this.keys = /* @__PURE__ */ new Map();
      }
      intern(node) {
        const key = JSON.stringify(node);
        const existing = this.keys.get(key);
        if (existing !== void 0) return existing;
        const id = this.nodes.length;
        this.keys.set(key, id);
        this.nodes.push({ id, ...node });
        return id;
      }
      number(value, raw) {
        return this.intern({ kind: "number", value, raw });
      }
      constant(name) {
        return this.intern({ kind: "constant", name });
      }
      parameter(name) {
        return this.intern({ kind: "parameter", name });
      }
      unary(op, arg) {
        return this.intern({ kind: "unary", op, args: [arg] });
      }
      binary(op, left, right) {
        return this.intern({ kind: "binary", op, args: [left, right] });
      }
      call(name, args) {
        return this.intern({ kind: "call", name, args });
      }
      label(id, label) {
        const node = this.nodes[id];
        if (node.label === label) return id;
        if (node.label === void 0) {
          this.nodes[id] = { ...node, label };
          return id;
        }
        const newId = this.nodes.length;
        this.nodes.push({ ...node, id: newId, label });
        return newId;
      }
    };
  }
});

// app/notices/ray-optics/source/formula/dag-util.js
function validateDagNodeLabel(label, fieldName = "label") {
  if (typeof label !== "string" || label.length === 0) {
    throw new TypeError(`Invalid ${fieldName}: ${JSON.stringify(label)}`);
  }
  return label;
}
var init_dag_util = __esm({
  "app/notices/ray-optics/source/formula/dag-util.js"() {
    "use strict";
  }
});

// app/notices/ray-optics/source/formula/formula-syntax.js
function isFormulaIdentifierStart(char) {
  return char !== void 0 && /[$_\p{ID_Start}]/u.test(char);
}
function isFormulaIdentifierContinue(char) {
  return char !== void 0 && /[$_\u200c\u200d\p{ID_Continue}]/u.test(char);
}
function isValidFormulaParameterName(name) {
  if (typeof name !== "string" || name.length === 0) return false;
  if (RESERVED_NAMES.has(name)) return false;
  if (!isFormulaIdentifierStart(name[0])) return false;
  for (let index = 1; index < name.length; index += 1) {
    if (!isFormulaIdentifierContinue(name[index])) return false;
  }
  return true;
}
var CONSTANTS, UNARY_FUNCTIONS, BINARY_FUNCTIONS, VARIADIC_FUNCTIONS, RESERVED_NAMES;
var init_formula_syntax = __esm({
  "app/notices/ray-optics/source/formula/formula-syntax.js"() {
    "use strict";
    CONSTANTS = /* @__PURE__ */ new Set(["pi", "e"]);
    UNARY_FUNCTIONS = /* @__PURE__ */ new Set([
      "sqrt",
      "sin",
      "cos",
      "tan",
      "sec",
      "csc",
      "cot",
      "sinh",
      "cosh",
      "tanh",
      "log",
      "exp",
      "asin",
      "acos",
      "atan",
      "asinh",
      "acosh",
      "atanh",
      "floor",
      "round",
      "ceil",
      "fix",
      "abs",
      "sign"
    ]);
    BINARY_FUNCTIONS = /* @__PURE__ */ new Set([
      "atan2",
      "guardNonzero",
      "guardNonNegative",
      "guardNotInteger",
      "guardValid",
      "fallback"
    ]);
    VARIADIC_FUNCTIONS = /* @__PURE__ */ new Set(["max", "min"]);
    RESERVED_NAMES = /* @__PURE__ */ new Set([
      ...CONSTANTS,
      ...UNARY_FUNCTIONS,
      ...BINARY_FUNCTIONS,
      ...VARIADIC_FUNCTIONS
    ]);
  }
});

// app/notices/ray-optics/source/formula/formula-parser.js
function splitStatements(input) {
  const statements = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0 && (char === ";" || char === "\n" || char === "\r")) {
      addStatement(statements, input, start, index);
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      start = index + 1;
    }
  }
  addStatement(statements, input, start, input.length);
  return statements;
}
function addStatement(statements, input, start, end) {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && /\s/u.test(input[trimmedStart])) trimmedStart += 1;
  while (trimmedEnd > trimmedStart && /\s/u.test(input[trimmedEnd - 1])) trimmedEnd -= 1;
  if (trimmedStart === trimmedEnd) return;
  statements.push({
    text: input.slice(trimmedStart, trimmedEnd),
    start: trimmedStart
  });
}
function findTopLevelAssignment(input) {
  let depth = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && char === "=") return index;
  }
  return -1;
}
function isAsciiDigit(char) {
  return char !== void 0 && char >= "0" && char <= "9";
}
function isNumberStart(char, next) {
  return isAsciiDigit(char) || char === "." && isAsciiDigit(next);
}
function isIdentifierStart(char) {
  return isFormulaIdentifierStart(char);
}
function isIdentifierContinue(char) {
  return isFormulaIdentifierContinue(char);
}
function parseFormula(input, parameters = [], options = {}) {
  if (typeof input !== "string") {
    throw new TypeError("input must be a string");
  }
  if (!Array.isArray(parameters)) {
    throw new TypeError("parameters must be an array of names");
  }
  const seen = /* @__PURE__ */ new Set();
  for (const name of parameters) {
    if (!isValidFormulaParameterName(name)) {
      throw new TypeError(`Invalid parameter name: ${JSON.stringify(name)}`);
    }
    if (seen.has(name)) {
      throw new TypeError(`Duplicate parameter name: ${JSON.stringify(name)}`);
    }
    seen.add(name);
  }
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("options must be an object");
  }
  const outputLabel = options.outputLabel;
  if (outputLabel !== void 0) {
    validateFormulaNodeLabel(outputLabel, seen, "outputLabel");
  }
  const dag = new ProgramParser(input, parameters).parse();
  if (outputLabel !== void 0) {
    const root = dag.nodes[dag.root];
    if (root.label !== void 0 && root.label !== outputLabel) {
      throw new TypeError(`outputLabel conflicts with assigned root label: ${JSON.stringify(root.label)}`);
    }
    dag.root = labelDagNode(dag, dag.root, outputLabel);
  }
  return dag;
}
function labelDagNode(dag, id, label) {
  const node = dag.nodes[id];
  if (node.label === label) return id;
  if (node.label === void 0) {
    dag.nodes[id] = { ...node, label };
    return id;
  }
  const newId = dag.nodes.length;
  dag.nodes.push({ ...node, id: newId, label });
  return newId;
}
function validateFormulaNodeLabel(label, _parameters = [], fieldName = "label") {
  return validateDagNodeLabel(label, fieldName);
}
var FormulaParseError, ProgramParser, Parser;
var init_formula_parser = __esm({
  "app/notices/ray-optics/source/formula/formula-parser.js"() {
    "use strict";
    init_dag_builder();
    init_dag_util();
    init_formula_syntax();
    FormulaParseError = class extends SyntaxError {
      constructor(message, input, index) {
        super(`${message} at index ${index}`);
        this.name = "FormulaParseError";
        this.index = index;
        this.input = input;
      }
    };
    ProgramParser = class {
      constructor(input, parameters) {
        this.input = input;
        this.parameters = new Set(parameters);
        this.dag = new DagBuilder();
        this.assignments = /* @__PURE__ */ new Map();
      }
      parse() {
        const statements = splitStatements(this.input);
        if (statements.length === 0) {
          throw new FormulaParseError("Expected expression", this.input, 0);
        }
        let root;
        for (const statement of statements) {
          root = this.parseStatement(statement);
        }
        return { root, nodes: this.dag.nodes };
      }
      parseStatement(statement) {
        const assignmentIndex = findTopLevelAssignment(statement.text);
        if (assignmentIndex === -1) {
          return this.parseExpression(statement.text, statement.start);
        }
        const name = statement.text.slice(0, assignmentIndex).trim();
        if (!isValidFormulaParameterName(name)) {
          throw new FormulaParseError(`Invalid assignment name: ${JSON.stringify(name)}`, this.input, statement.start);
        }
        if (this.parameters.has(name)) {
          throw new FormulaParseError(`assignment name must not clash with parameter name: ${JSON.stringify(name)}`, this.input, statement.start);
        }
        if (this.assignments.has(name)) {
          throw new FormulaParseError(`Duplicate assignment name: ${JSON.stringify(name)}`, this.input, statement.start);
        }
        const expressionStart = assignmentIndex + 1;
        const root = this.parseExpression(
          statement.text.slice(expressionStart),
          statement.start + expressionStart
        );
        const labeledRoot = this.dag.label(root, name);
        this.assignments.set(name, labeledRoot);
        return labeledRoot;
      }
      parseExpression(input, baseIndex) {
        return new Parser(input, this.parameters, {
          assignments: this.assignments,
          baseIndex,
          dag: this.dag,
          sourceInput: this.input
        }).parse();
      }
    };
    Parser = class {
      constructor(input, parameters, options = {}) {
        this.input = input;
        this.index = 0;
        this.parameters = new Set(parameters);
        this.assignments = options.assignments ?? /* @__PURE__ */ new Map();
        this.baseIndex = options.baseIndex ?? 0;
        this.sourceInput = options.sourceInput ?? input;
        this.dag = options.dag ?? new DagBuilder();
      }
      parse() {
        const root = this.parseAdditive();
        this.skipWhitespace();
        if (!this.isEnd()) {
          this.error(`Unexpected token ${JSON.stringify(this.peek())}`);
        }
        return root;
      }
      parseAdditive() {
        let left = this.parseMultiplicative();
        while (true) {
          this.skipWhitespace();
          if (this.consume("+")) {
            const right = this.parseMultiplicative();
            left = this.dag.binary("+", left, right);
          } else if (this.consume("-")) {
            const right = this.parseMultiplicative();
            left = this.dag.binary("-", left, right);
          } else {
            return left;
          }
        }
      }
      parseMultiplicative() {
        let left = this.parseUnary();
        while (true) {
          this.skipWhitespace();
          if (this.consume("*")) {
            const right = this.parseUnary();
            left = this.dag.binary("*", left, right);
          } else if (this.consume("/")) {
            const right = this.parseUnary();
            left = this.dag.binary("/", left, right);
          } else {
            return left;
          }
        }
      }
      parseUnary() {
        this.skipWhitespace();
        if (this.consume("-")) {
          return this.dag.unary("-", this.parseUnary());
        }
        return this.parsePower();
      }
      parsePower() {
        const left = this.parsePrimary();
        this.skipWhitespace();
        if (!this.consume("^")) return left;
        const right = this.parseUnary();
        return this.dag.binary("^", left, right);
      }
      parsePrimary() {
        this.skipWhitespace();
        if (this.isEnd()) this.error("Expected expression");
        if (this.consume("(")) {
          const expr = this.parseAdditive();
          this.skipWhitespace();
          if (!this.consume(")")) this.error("Expected ')'");
          return expr;
        }
        const char = this.peek();
        if (isNumberStart(char, this.peek(1))) return this.parseNumber();
        if (isIdentifierStart(char)) return this.parseName();
        this.error(`Unexpected token ${JSON.stringify(char)}`);
      }
      parseNumber() {
        const start = this.index;
        const input = this.input;
        if (this.peek() === ".") {
          this.index += 1;
          this.consumeDigits();
        } else {
          this.consumeDigits();
          if (this.peek() === ".") {
            this.index += 1;
            this.consumeDigits();
          }
        }
        if (this.peek()?.toLowerCase() === "e") {
          const exponentStart = this.index;
          this.index += 1;
          if (this.peek() === "+" || this.peek() === "-") this.index += 1;
          const digitStart = this.index;
          this.consumeDigits();
          if (this.index === digitStart) {
            this.index = exponentStart;
            this.error("Expected exponent digits");
          }
        }
        const raw = input.slice(start, this.index);
        const value = Number(raw);
        if (!Number.isFinite(value)) this.error("Number must be finite");
        return this.dag.number(value, raw);
      }
      parseName() {
        const name = this.consumeIdentifier();
        this.skipWhitespace();
        if (this.consume("(")) {
          if (UNARY_FUNCTIONS.has(name)) {
            const arg = this.parseSingleFunctionArgument(name);
            return this.dag.call(name, [arg]);
          }
          if (BINARY_FUNCTIONS.has(name)) {
            const args = this.parseFixedFunctionArguments(name, 2);
            return this.dag.call(name, args);
          }
          if (VARIADIC_FUNCTIONS.has(name)) {
            const args = this.parseVariadicFunctionArguments(name);
            return this.dag.call(name, args);
          }
          if (RESERVED_NAMES.has(name)) {
            this.error(`Name ${JSON.stringify(name)} is not callable`);
          }
          this.error(`Unknown function ${JSON.stringify(name)}`);
        }
        if (CONSTANTS.has(name)) return this.dag.constant(name);
        if (RESERVED_NAMES.has(name)) {
          this.error(`Function ${JSON.stringify(name)} must be called with parentheses`);
        }
        if (this.assignments.has(name)) return this.assignments.get(name);
        if (!this.parameters.has(name)) {
          this.error(`Unknown parameter ${JSON.stringify(name)}`);
        }
        return this.dag.parameter(name);
      }
      parseSingleFunctionArgument(name) {
        this.skipWhitespace();
        if (this.consume(")")) this.error(`Function ${name} requires one argument`);
        const arg = this.parseAdditive();
        this.skipWhitespace();
        if (this.consume(",")) this.error(`Function ${name} accepts exactly one argument`);
        if (!this.consume(")")) this.error("Expected ')'");
        return arg;
      }
      parseFixedFunctionArguments(name, count) {
        const args = [];
        this.skipWhitespace();
        if (this.consume(")")) this.error(`Function ${name} requires ${count} arguments`);
        while (true) {
          args.push(this.parseAdditive());
          this.skipWhitespace();
          if (this.consume(")")) {
            if (args.length !== count) this.error(`Function ${name} accepts exactly ${count} arguments`);
            return args;
          }
          if (!this.consume(",")) this.error("Expected ',' or ')'");
          this.skipWhitespace();
          if (this.peek() === ")") this.error(`Function ${name} does not allow trailing comma`);
          if (args.length >= count) this.error(`Function ${name} accepts exactly ${count} arguments`);
        }
      }
      parseVariadicFunctionArguments(name) {
        const args = [];
        this.skipWhitespace();
        if (this.consume(")")) this.error(`Function ${name} requires at least one argument`);
        while (true) {
          args.push(this.parseAdditive());
          this.skipWhitespace();
          if (this.consume(")")) return args;
          if (!this.consume(",")) this.error("Expected ',' or ')'");
          this.skipWhitespace();
          if (this.peek() === ")") this.error(`Function ${name} does not allow trailing comma`);
        }
      }
      consumeDigits() {
        while (isAsciiDigit(this.peek())) this.index += 1;
      }
      consumeIdentifier() {
        const start = this.index;
        this.index += 1;
        while (!this.isEnd() && isIdentifierContinue(this.peek())) this.index += 1;
        return this.input.slice(start, this.index);
      }
      skipWhitespace() {
        while (!this.isEnd() && /\s/u.test(this.peek())) this.index += 1;
      }
      consume(expected) {
        if (this.input.startsWith(expected, this.index)) {
          this.index += expected.length;
          return true;
        }
        return false;
      }
      peek(offset = 0) {
        return this.input[this.index + offset];
      }
      isEnd() {
        return this.index >= this.input.length;
      }
      error(message) {
        throw new FormulaParseError(message, this.sourceInput, this.baseIndex + this.index);
      }
    };
  }
});

// app/notices/ray-optics/source/simulationEngines/rayPower.js
function normalizeRayPowerCutoff(value) {
  const cutoff = value ?? DEFAULT_RAY_POWER_CUTOFF;
  if (typeof cutoff !== "number" || Number.isNaN(cutoff) || cutoff < 0) {
    throw new RangeError("rayPowerCutoff must be a nonnegative number.");
  }
  return cutoff;
}
function normalizeRayPowerSampling(value) {
  const sampling = value ?? DEFAULT_RAY_POWER_SAMPLING;
  if (typeof sampling !== "boolean") {
    throw new TypeError("rayPowerSampling must be a boolean.");
  }
  return sampling;
}
function getEffectiveRayPowerOptions(options = {}) {
  if ((options.colorMode ?? "default") === "default") {
    return {
      rayPowerCutoff: DEFAULT_COLOR_RAY_POWER_CUTOFF,
      rayPowerSampling: true
    };
  }
  return {
    rayPowerCutoff: normalizeRayPowerCutoff(options.rayPowerCutoff),
    rayPowerSampling: normalizeRayPowerSampling(options.rayPowerSampling)
  };
}
var DEFAULT_RAY_POWER_CUTOFF, DEFAULT_RAY_POWER_SAMPLING, DEFAULT_COLOR_RAY_POWER_CUTOFF;
var init_rayPower = __esm({
  "app/notices/ray-optics/source/simulationEngines/rayPower.js"() {
    "use strict";
    DEFAULT_RAY_POWER_CUTOFF = 1e-6;
    DEFAULT_RAY_POWER_SAMPLING = false;
    DEFAULT_COLOR_RAY_POWER_CUTOFF = 0.01;
  }
});

// app/notices/ray-optics/source/sceneObjs/BaseGlass.js
var CONSTANT_REFRACTIVE_INDEX_BULK_TYPE, CAUCHY_DISPERSION_BULK_TYPE, BaseGlass, BaseGlass_default;
var init_BaseGlass = __esm({
  "app/notices/ray-optics/source/sceneObjs/BaseGlass.js"() {
    "use strict";
    init_BaseSceneObj();
    init_i18next();
    init_geometry();
    init_formula_parser();
    init_rayPower();
    CONSTANT_REFRACTIVE_INDEX_BULK_TYPE = {
      name: "Constant refractive index",
      paramNames: ["n_0"],
      dag: parseFormula("alpha = 0; n = n_0", ["n_0"])
    };
    CAUCHY_DISPERSION_BULK_TYPE = {
      name: "Cauchy dispersion",
      paramNames: ["A", "B"],
      dag: parseFormula(
        "alpha = 0; n = A + B / (lambda * lambda * 0.000001)",
        ["lambda", "A", "B"]
      )
    };
    BaseGlass = class extends BaseSceneObj_default {
      static getPropertySchema(objData, scene) {
        return [
          {
            key: "refIndex",
            type: "number",
            label: instance.t("main:meta.parentheses", { main: instance.t("simulator:sceneObjs.BaseGlass.refIndex"), sub: instance.t("simulator:sceneObjs.BaseGlass.cauchyCoeff") + " A" }),
            info: "<p>" + instance.t("simulator:sceneObjs.BaseGlass.refIndexInfo.dualMeaning") + "</p><p>*" + instance.t("simulator:sceneObjs.BaseGlass.refIndexInfo.relative") + "</p><p>" + instance.t("simulator:sceneObjs.BaseGlass.refIndexInfo.effective") + "</p>"
          },
          { key: "cauchyB", type: "number", label: instance.t("simulator:sceneObjs.BaseGlass.cauchyCoeff") + " B (\u03BCm\xB2)" },
          { key: "partialReflect", type: "boolean", label: instance.t("simulator:sceneObjs.BaseGlass.partialReflect") }
        ];
      }
      populateObjBar(objBar) {
        if (this.scene.simulateColors) {
          objBar.createNumber(instance.t("simulator:sceneObjs.BaseGlass.cauchyCoeff") + " A", 1, 3, 0.01, this.refIndex, function(obj, value) {
            obj.refIndex = value * 1;
          }, "<p>*" + instance.t("simulator:sceneObjs.BaseGlass.refIndexInfo.relative") + "</p><p>" + instance.t("simulator:sceneObjs.BaseGlass.refIndexInfo.effective") + "</p>");
          objBar.createNumber("B(\u03BCm\xB2)", 1e-4, 0.02, 1e-4, this.cauchyB, function(obj, value) {
            obj.cauchyB = value;
          });
        } else {
          objBar.createNumber(instance.t("simulator:sceneObjs.BaseGlass.refIndex") + "*", 0.5, 2.5, 0.01, this.refIndex, function(obj, value) {
            obj.refIndex = value * 1;
          }, "<p>*" + instance.t("simulator:sceneObjs.BaseGlass.refIndexInfo.relative") + "</p><p>" + instance.t("simulator:sceneObjs.BaseGlass.refIndexInfo.effective") + "</p>");
        }
        if (objBar.showAdvanced(!this.arePropertiesDefault(["partialReflect"]))) {
          objBar.createBoolean(instance.t("simulator:sceneObjs.BaseGlass.partialReflect"), this.partialReflect, function(obj, value) {
            obj.partialReflect = value;
          });
        }
      }
      getZIndex() {
        return this.refIndex * -1;
      }
      /* Utility methods */
      /**
       * Create a homogeneous glass region primitive with the supplied boundary.
       * @param {PrimitiveCurve[]} curves - The closed region boundary.
       * @returns {RegionPrimitive} The region primitive.
       */
      createGlassPrimitive(curves) {
        const useCauchyDispersion = this.scene.simulateColors;
        return {
          kind: "region",
          curves,
          bulkType: useCauchyDispersion ? CAUCHY_DISPERSION_BULK_TYPE : CONSTANT_REFRACTIVE_INDEX_BULK_TYPE,
          params: useCauchyDispersion ? { A: this.refIndex, B: this.cauchyB } : { n_0: this.refIndex },
          stepSize: 0,
          partialReflect: this.partialReflect
        };
      }
      /**
       * Fill the glass with the color that represents the refractive index. To be called in `draw` of a subclass when the path has been set up with `canvasRenderer.ctx.beginPath()`, etc.
       * @param {CanvasRenderer} canvasRenderer - The canvas renderer.
       * @param {boolean} isAboveLight - Whether the rendering layer is above the light layer.
       * @param {boolean} isHovered - Whether the object is hovered by the mouse, which determines the style of the object to be drawn, e.g., with lighlighted color.
       */
      fillGlass(canvasRenderer, isAboveLight, isHovered) {
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        const n = this.refIndex;
        const allowColorSubtraction = !canvasRenderer.isSVG && this.scene.theme.background.color.r === 0 && this.scene.theme.background.color.g === 0 && this.scene.theme.background.color.b === 0;
        if (isAboveLight) {
          ctx.globalAlpha = 0.1;
          ctx.fillStyle = isHovered ? this.scene.highlightColorCss : "transparent";
          ctx.fill("evenodd");
          ctx.globalAlpha = 1;
          return;
        }
        const mod_neg = n < 0 ? -1 : 1;
        if (n * mod_neg >= 1) {
          var alpha = Math.log(n * mod_neg) / Math.log(1.5) * 0.2;
          if (allowColorSubtraction) {
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = mod_neg < 0 ? "rgb(" + Math.round(alpha * this.scene.theme.glass.color.r * 0.75 * 255) + "," + Math.round(alpha * this.scene.theme.glass.color.g * 255) + "," + Math.round(alpha * this.scene.theme.glass.color.b * 0.75 * 255) + ")" : "rgb(" + Math.round(alpha * this.scene.theme.glass.color.r * 255) + "," + Math.round(alpha * this.scene.theme.glass.color.g * 255) + "," + Math.round(alpha * this.scene.theme.glass.color.b * 255) + ")";
          } else {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = "rgb(" + Math.round(this.scene.theme.glass.color.r * 255) + "," + Math.round(this.scene.theme.glass.color.g * 255) + "," + Math.round(this.scene.theme.glass.color.b * 255) + ")";
          }
          ctx.fill("evenodd");
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        } else {
          var alpha = Math.log(1 / (n * mod_neg)) / Math.log(1.5) * 0.2;
          if (allowColorSubtraction) {
            var imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
            var data = imageData.data;
            ctx.putImageData(imageData, 0, 0);
            ctx.globalCompositeOperation = "difference";
            ctx.fillStyle = "rgb(" + alpha * this.scene.theme.glass.color.r * 100 + "%,0%,0%)";
            ctx.fill("evenodd");
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = "white";
            ctx.globalAlpha = 1;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.setTransform(canvasRenderer.scale, 0, 0, canvasRenderer.scale, canvasRenderer.origin.x, canvasRenderer.origin.y);
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = "rgb(0%," + alpha * this.scene.theme.glass.color.g * 100 + "%," + alpha * this.scene.theme.glass.color.b * 100 + "%)";
            ctx.fill("evenodd");
            ctx.globalCompositeOperation = "difference";
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.setTransform(canvasRenderer.scale, 0, 0, canvasRenderer.scale, canvasRenderer.origin.x, canvasRenderer.origin.y);
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
          } else {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : "rgb(70,70,70)";
            ctx.lineWidth = 1 * ls;
            ctx.stroke();
          }
        }
      }
      /**
       * Do the refraction calculation at the surface of the glass.
       * @param {Ray} ray - The ray to be refracted.
       * @param {number} rayIndex - The index of the ray in the ray array.
       * @param {Point} incidentPoint - The incident point.
       * @param {Point} normal - The normal vector at the incident point.
       * @param {number} n1 - The effective refractive index of the current object (after determining the direction of incident of the current object, but before merging the surface with other objects).
       * @param {Array<BaseGlass>} surfaceMergingObjs - The objects that are to be merged with the current object.
       * @param {BaseGrinGlass} bodyMergingObj - The object that is to be merged with the current object.
       * @returns {SimulationReturn} The return value for `onRayIncident`.
       */
      refract(ray, rayIndex, incidentPoint, normal, n1, surfaceMergingObjs, bodyMergingObj) {
        for (var i = 0; i < surfaceMergingObjs.length; i++) {
          let incidentType = surfaceMergingObjs[i].getIncidentType(ray);
          if (incidentType == 1) {
            n1 *= surfaceMergingObjs[i].getRefIndexAt(incidentPoint, ray);
            surfaceMergingObjs[i].onRayExit(ray);
          } else if (incidentType == -1) {
            n1 /= surfaceMergingObjs[i].getRefIndexAt(incidentPoint, ray);
            surfaceMergingObjs[i].onRayEnter(ray);
          } else if (incidentType == 0) {
          } else {
            return {
              isAbsorbed: true,
              isUndefinedBehavior: true
            };
          }
        }
        var mod_neg = false;
        if (n1 < 0) {
          n1 = -n1;
          mod_neg = true;
        }
        var normal_len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
        var normal_x = normal.x / normal_len;
        var normal_y = normal.y / normal_len;
        var ray_len = Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y));
        var ray_x = (ray.p2.x - ray.p1.x) / ray_len;
        var ray_y = (ray.p2.y - ray.p1.y) / ray_len;
        var cos1 = -normal_x * ray_x - normal_y * ray_y;
        var sq1 = 1 - n1 * n1 * (1 - cos1 * cos1);
        if (sq1 < 0) {
          ray.p1 = incidentPoint;
          ray.p2 = geometry_default.point(incidentPoint.x + ray_x + 2 * cos1 * normal_x, incidentPoint.y + ray_y + 2 * cos1 * normal_y);
          if (bodyMergingObj) {
            ray.bodyMergingObj = bodyMergingObj;
          }
        } else {
          var cos22 = Math.sqrt(sq1);
          if (this.partialReflect) {
            var R_s = Math.pow((n1 * cos1 - cos22) / (n1 * cos1 + cos22), 2);
            var R_p = Math.pow((n1 * cos22 - cos1) / (n1 * cos22 + cos1), 2);
          } else {
            var R_s = 0;
            var R_p = 0;
          }
          let newRays = [];
          let truncation = 0;
          const {
            rayPowerCutoff,
            rayPowerSampling
          } = getEffectiveRayPowerOptions(this.scene);
          var ray2 = geometry_default.line(incidentPoint, geometry_default.point(incidentPoint.x + ray_x + 2 * cos1 * normal_x, incidentPoint.y + ray_y + 2 * cos1 * normal_y));
          ray2.brightness_s = ray.brightness_s * R_s;
          ray2.brightness_p = ray.brightness_p * R_p;
          ray2.wavelength = ray.wavelength;
          ray2.gap = ray.gap;
          if (bodyMergingObj) {
            ray2.bodyMergingObj = bodyMergingObj;
          }
          const reflectedPower = ray2.brightness_s + ray2.brightness_p;
          if (reflectedPower > 0 && reflectedPower >= rayPowerCutoff) {
            newRays.push(ray2);
          } else {
            truncation += reflectedPower;
            if (reflectedPower > 0 && rayPowerSampling && !ray.gap) {
              var amp = Math.floor(rayPowerCutoff / reflectedPower) + 1;
              if (rayIndex % amp == 0) {
                ray2.brightness_s = ray2.brightness_s * amp;
                ray2.brightness_p = ray2.brightness_p * amp;
                newRays.push(ray2);
              }
            }
          }
          if (mod_neg) {
            n1 = -n1;
            cos22 = Math.cos(2 * Math.PI - Math.acos(cos22));
          }
          ray.p1 = incidentPoint;
          ray.p2 = geometry_default.point(incidentPoint.x + n1 * ray_x + (n1 * cos1 - cos22) * normal_x, incidentPoint.y + n1 * ray_y + (n1 * cos1 - cos22) * normal_y);
          ray.brightness_s = ray.brightness_s * (1 - R_s);
          ray.brightness_p = ray.brightness_p * (1 - R_p);
          const refractedPower = ray.brightness_s + ray.brightness_p;
          const refractedCutoff = this.scene.colorMode === "default" ? 0 : rayPowerCutoff;
          if (refractedPower > 0 && refractedPower >= refractedCutoff) {
            return {
              newRays,
              truncation
            };
          } else {
            return {
              isAbsorbed: true,
              newRays,
              truncation: truncation + refractedPower
            };
          }
        }
      }
      /**
       * Get the refractive index at a point for a ray
       * @param {Point} point - The point to get the refractive index. For normal glasses, this parameter is not used. But it will be used in GRIN glasses.
       * @param {Ray} ray - The ray to be refracted.
       * @returns {number} - The refractive index at the point.
       */
      getRefIndexAt(point, ray) {
        if (this.scene.simulateColors) {
          return this.refIndex + this.cauchyB / (ray.wavelength * ray.wavelength * 1e-6);
        } else {
          return this.refIndex;
        }
      }
      /* Abstract methods */
      /**
       * Get whether the ray is incident from inside to outside or from outside to inside.
       * @param {Ray} ray - The ray to be checked.
       * @returns {number} - 1 if the ray is incident from inside to outside, -1 if the ray is incident from outside to inside, 0 if the ray is equivalent to not intersecting the glass (e.g. intersecting with two overlapping surfaces of the glass), and NaN for other situations (e.g. parallel to a surface).
       */
      getIncidentType(ray) {
      }
      /**
       * Handle the event when a ray enters the glass. This is called during the surface merging process, and is called by the glass object who is handling the surface merging, rather than by the simulator. Unlike `onRayIncident` which is only called for one representative object who is responsible for handling the surface merging, this function is called for every object that consistute the merged surface.  For notmal glasses nothing needs to be done in this function, but for GRIN glasses, the body-merging object in the ray should be updated here, so that the ray knows that it now feels a different refractive index gradient.
       * @param {Ray} ray - The ray that enters the glass.
       */
      onRayEnter(ray) {
      }
      /**
       * Handle the event when a ray exits the glass. This is called during the surface merging process, and is called by the glass object who is handling the surface merging, rather than by the simulator. Unlike `onRayIncident` which is only called for one representative object who is responsible for handling the surface merging, this function is called for every object that consistute the merged surface.  For notmal glasses nothing needs to be done in this function, but for GRIN glasses, the body-merging object in the ray should be updated here, so that the ray knows that it now feels a different refractive index gradient.
       * @param {Ray} ray - The ray that exits the glass.
       */
      onRayExit(ray) {
      }
    };
    BaseGlass_default = BaseGlass;
  }
});

// app/notices/ray-optics/source/Simulator.js
var import_canvas2svg2, Simulator, Simulator_default;
var init_Simulator = __esm({
  "app/notices/ray-optics/source/Simulator.js"() {
    "use strict";
    init_CanvasRenderer();
    init_FloatColorRenderer();
    init_geometry();
    import_canvas2svg2 = __toESM(require_canvas2svg(), 1);
    init_sceneObjs();
    init_BaseGlass();
    init_i18next();
    Simulator = class _Simulator {
      /**
       * The minimal length between two interactions with rays (when smaller than this, the interaction will be ignored). Also the threshold for surface merging.
       */
      static MIN_RAY_SEGMENT_LENGTH = 1e-6;
      static MIN_RAY_SEGMENT_LENGTH_SQUARED = _Simulator.MIN_RAY_SEGMENT_LENGTH * _Simulator.MIN_RAY_SEGMENT_LENGTH;
      /**
       * The threshold for the total brightness of rays where an undefined behavior is encountered. Above this threshold, a warning will be shown.
       */
      static UNDEFINED_BEHAVIOR_THRESHOLD = 1e-3;
      static UV_WAVELENGTH = 380;
      static VIOLET_WAVELENGTH = 420;
      static BLUE_WAVELENGTH = 460;
      static CYAN_WAVELENGTH = 500;
      static GREEN_WAVELENGTH = 540;
      static YELLOW_WAVELENGTH = 580;
      static RED_WAVELENGTH = 620;
      static INFRARED_WAVELENGTH = 700;
      /**
       * Creates a new Simulator instance.
       * @param {Scene} scene - The scene to be simulated.
       * @param {CanvasRenderingContext2D|C2S} [ctxMain=null] - The default context for drawing the scene.
       * @param {CanvasRenderingContext2D|C2S} [ctxBelowLight=null] - The context for drawing the scene below the light layer.
       * @param {CanvasRenderingContext2D|C2S} [ctxAboveLight=null] - The context for drawing the scene above the light layer.
       * @param {CanvasRenderingContext2D|C2S} [ctxGrid=null] - The context for drawing the grid layer.
       * @param {CanvasRenderingContext2D} [ctxVirtual=null] - The virtual context for color adjustment.
       * @param {boolean} [enableTimer=false] - Whether to enable the timer for the simulation.
       * @param {number} [rayCountLimit=Infinity] - The maximum number of processed rays in the simulation.
       * @param {WebGLRenderingContext|null} [glMain=null] - The default WebGL context for drawing the scene (used only if the colorMode is not 'default').
       * @param {WebGLRenderingContext|null} [glVirtual=null] - Additional WebGL context.
       * @param {function|null} [tempCanvasFactory=null] - Factory for temporary bitmap canvases. Receives `(width, height)` and returns a canvas-like object.
       */
      constructor(scene, ctxMain = null, ctxBelowLight = null, ctxAboveLight = null, ctxGrid = null, ctxVirtual = null, enableTimer = false, rayCountLimit = Infinity, glMain = null, glVirtual = null, tempCanvasFactory = null) {
        this.scene = scene;
        this.scene.simulator = this;
        this.ctxMain = ctxMain;
        this.ctxBelowLight = ctxBelowLight;
        this.ctxAboveLight = ctxAboveLight;
        this.ctxGrid = ctxGrid;
        this.ctxVirtual = ctxVirtual;
        if (typeof import_canvas2svg2.default !== "undefined" && ctxMain && ctxMain.constructor === import_canvas2svg2.default) {
          this.isSVG = true;
        }
        this.dpr = 1;
        this.enableTimer = enableTimer;
        this.rayCountLimit = rayCountLimit;
        this.glMain = glMain;
        this.glVirtual = glVirtual;
        this.tempCanvasFactory = tempCanvasFactory;
        this.pendingRays = [];
        this.simulationTimerId = -1;
        this.shouldSimulatorStop = false;
        this.simulationStartTime = null;
        this.totalTruncation = 0;
        this.totalUndefinedBehavior = 0;
        this.undefinedBehaviorObjs = [];
        this.brightnessScale = 0;
        this.processedRayCount = 0;
        this.manualLightRedraw = false;
        this.isLightLayerSynced = true;
        this.lastOrigin = geometry_default.point(0, 0);
        this.lastScale = 1;
        this.error = null;
        this.warning = null;
        this.eventListeners = {};
        this.canvasRendererMain = null;
        this.canvasRendererBelowLight = null;
        this.canvasRendererAboveLight = null;
        this.canvasRendererGrid = null;
      }
      /**
       * Get the theme-based color for a ray type.
       * @param {string} rayType - The type of ray ('ray', 'extendedRay', 'forwardExtendedRay', 'colorRay', 'colorExtendedRay', 'colorForwardExtendedRay')
       * @param {number} alpha - The alpha value
       * @returns {Array<number>} RGBA color array
       */
      getThemeRayColor(rayType, alpha) {
        const theme = this.scene.theme;
        const colorData = theme[rayType]?.color || theme.ray.color;
        return [colorData.r, colorData.g, colorData.b, alpha];
      }
      /**
       * Get the theme-based dash pattern for a ray type.
       * @param {string} rayType - The type of ray ('ray', 'extendedRay', 'forwardExtendedRay', 'colorRay', 'colorExtendedRay', 'colorForwardExtendedRay')
       * @returns {Array<number>} Dash pattern array
       */
      getThemeRayDash(rayType) {
        const theme = this.scene.theme;
        const dash = theme[rayType]?.dash || theme.ray.dash;
        return dash;
      }
      /**
       * Get the theme-based color for an image type.
       * @param {string} imageType - The type of image ('realImage', 'virtualImage', 'virtualObject', 'colorRealImage', 'colorVirtualImage', 'colorVirtualObject')
       * @param {number} alpha - The alpha value
       * @returns {Array<number>} RGBA color array
       */
      getThemeImageColor(imageType, alpha) {
        const theme = this.scene.theme;
        const colorData = theme[imageType]?.color || theme.realImage.color;
        if (imageType === "virtualObject" && colorData.r === 0.3 && colorData.g === 0.3 && colorData.b === 0.3 && this.scene.colorMode !== "default") {
          return [0.03, 0.03, 0.03, alpha];
        }
        return [colorData.r, colorData.g, colorData.b, alpha];
      }
      /**
       * Get the theme-based size for an image type.
       * @param {string} imageType - The type of image ('realImage', 'virtualImage', 'virtualObject', 'colorRealImage', 'colorVirtualImage', 'colorVirtualObject')
       * @returns {number} Image size
       */
      getThemeImageSize(imageType) {
        const theme = this.scene.theme;
        return theme[imageType]?.size || theme.realImage.size || 5;
      }
      /**
       * Add an event listener to the simulator.
       * @param {string} eventName - The name of the event.
       * @param {function} callback - The callback function.
       */
      on(eventName, callback) {
        if (!this.eventListeners[eventName]) {
          this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
      }
      /**
       * Emit an event.
       * @param {string} eventName - The name of the event.
       * @param {any} data - The data to be passed to the callback functions.
       */
      emit(eventName, data) {
        if (this.eventListeners[eventName]) {
          this.eventListeners[eventName].forEach((callback) => callback(data));
        }
      }
      /**
       * The event emitted when the simulation is to be updated. Fired even if the light layer and/or grid layer are not going to be redrawn.
       * @event Simulator#update
       */
      /**
       * The event emitted when the simulation starts.
       * @event Simulator#simulationStart
       */
      /**
       * The event emitted when the simulation pauses (when the timer is enabled and the maximum continue running time is exceeded).
       * @event Simulator#simulationPause
       */
      /**
       * The event emitted when the simulation completes (all the rays are processed completely).
       * @event Simulator#simulationComplete
       */
      /**
       * The event emitted when the sync status of the light layer changes.
       * @event Simulator#lightLayerSyncChange
       * @type {object}
       * @property {boolean} isSynced - Whether the light layer is in sync with the scene.
       */
      /**
       * The event emitted when the simulation stops (when the maximum number of processed rays is reached or if the user force stop the simulation).
       * @event Simulator#simulationStop
       */
      /**
       * The event when the error and warning messages in the UI should be updated.
       * @event requestUpdateErrorAndWarning
       */
      /**
       * The event when the WebGL context is lost.
       * @event webglContextLost
       */
      /**
       * Draw editor-driven highlight points on the above-light layer (same style as {@link sceneObjs.Handle} control-point dashed circles when highlighted).
       * @param {Object|null} canvasRenderer - {@link CanvasRenderer} instance or null.
       * @returns {void}
       */
      drawExternalHighlightPoints(canvasRenderer) {
        if (!canvasRenderer || !canvasRenderer.ctx || !this.scene.editor) {
          return;
        }
        var pts = this.scene.editor.externalHighlightPoints;
        if (!pts || !pts.length) {
          return;
        }
        var ctx = canvasRenderer.ctx;
        var ls = canvasRenderer.lengthScale;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5 * ls;
        ctx.strokeStyle = this.scene.highlightColorCss;
        ctx.setLineDash([2.1 * ls, 2.1 * ls]);
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          if (!p || typeof p.x !== "number" || typeof p.y !== "number") {
            continue;
          }
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
            continue;
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4 * ls, 0, Math.PI * 2, false);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();
      }
      /**
       * Create a temporary bitmap canvas for intermediate rendering.
       * Uses the injected factory when available, except for SVG export in browser where a DOM canvas is preferred.
       * @param {number} width - Canvas width in pixels.
       * @param {number} height - Canvas height in pixels.
       * @returns {HTMLCanvasElement|OffscreenCanvas|object|null}
       */
      createTempCanvas(width, height) {
        if (this.isSVG && typeof document !== "undefined") {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          return canvas;
        }
        if (this.tempCanvasFactory) {
          return this.tempCanvasFactory(width, height);
        }
        if (typeof OffscreenCanvas !== "undefined") {
          return new OffscreenCanvas(width, height);
        }
        if (typeof document !== "undefined") {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          return canvas;
        }
        return null;
      }
      /**
       * Run the simulation and draw the this.scene on the canvases.
       * @param {boolean} skipLight - Whether to skip the light layer.
       * @param {boolean} skipGrid - Whether to skip the grid layer.
       * @param {boolean} forceRedraw - Whether to force redraw the light layer (when the user choose to manually redraw the light layer).
       * @returns {void}
       */
      updateSimulation(skipLight, skipGrid, forceRedraw) {
        this.emit("update", { skipLight, skipGrid, forceRedraw });
        if (!skipLight && this.ctxMain?.canvas?.style) {
          if (this.manualLightRedraw && !forceRedraw) {
            this.isLightLayerSynced = false;
            this.emit("lightLayerSyncChange", { isSynced: false });
          } else {
            this.isLightLayerSynced = true;
            this.emit("lightLayerSyncChange", { isSynced: true });
          }
        }
        let shouldClearLightLayer = false;
        if (this.lastScale != this.scene.scale || this.lastOrigin.x != this.scene.origin.x || this.lastOrigin.y != this.scene.origin.y) {
          shouldClearLightLayer = true;
        }
        skipLight = skipLight || this.manualLightRedraw && !forceRedraw;
        if (!skipLight) {
          this.lastScale = this.scene.scale;
          this.lastOrigin.x = this.scene.origin.x;
          this.lastOrigin.y = this.scene.origin.y;
          this.totalTruncation = 0;
          this.totalUndefinedBehavior = 0;
          this.undefinedBehaviorObjs = [];
          this.brightnessScale = 0;
          this.simulationStartTime = /* @__PURE__ */ new Date();
          this.emit("simulationStart", null);
        }
        if (!skipLight && this.simulationTimerId != -1) {
          clearTimeout(this.simulationTimerId);
          this.simulationTimerId = -1;
        }
        if (this.ctxBelowLight && this.ctxAboveLight) {
          this.canvasRendererBelowLight = new CanvasRenderer_default(this.ctxBelowLight, { x: this.scene.origin.x * this.dpr, y: this.scene.origin.y * this.dpr }, this.scene.scale * this.dpr, this.scene.lengthScale, this.scene.backgroundImage);
          this.canvasRendererAboveLight = new CanvasRenderer_default(this.ctxAboveLight, { x: this.scene.origin.x * this.dpr, y: this.scene.origin.y * this.dpr }, this.scene.scale * this.dpr, this.scene.lengthScale);
        }
        if (this.ctxMain && this.scene.colorMode != "default" && !this.glMain) {
          this.scene.colorMode = "default";
          this.error = instance.t("simulator:settings.correctBrightness.error");
          this.emit("requestUpdateErrorAndWarning");
          this.emit("webglContextLost");
        }
        if (this.canvasRendererMain && this.canvasRendererMain.destroy && this.scene.colorMode == "default") {
          this.canvasRendererMain.destroy();
          this.canvasRendererMain = null;
        }
        if ((!skipLight || shouldClearLightLayer) && this.ctxMain) {
          if (this.scene.colorMode != "default") {
            var colorMode = this.scene.colorMode;
            if (this.canvasRendererMain && this.canvasRendererMain.colorMode == colorMode && this.canvasRendererMain.scale == this.scene.scale * this.dpr && this.canvasRendererMain.lengthScale == this.scene.lengthScale && this.canvasRendererMain.origin.x == this.scene.origin.x * this.dpr && this.canvasRendererMain.origin.y == this.scene.origin.y * this.dpr && this.canvasRendererMain.width == this.ctxMain.canvas.width && this.canvasRendererMain.height == this.ctxMain.canvas.height) {
              this.canvasRendererMain.begin();
            } else {
              if (this.canvasRendererMain && this.canvasRendererMain.destroy) {
                this.canvasRendererMain.destroy();
              }
              this.canvasRendererMain = new FloatColorRenderer_default(this.glMain, { x: this.scene.origin.x * this.dpr, y: this.scene.origin.y * this.dpr }, this.scene.scale * this.dpr, this.scene.lengthScale, null, null, colorMode);
            }
          } else {
            this.canvasRendererMain = new CanvasRenderer_default(this.ctxMain, { x: this.scene.origin.x * this.dpr, y: this.scene.origin.y * this.dpr }, this.scene.scale * this.dpr, this.scene.lengthScale, null, this.ctxVirtual);
          }
          if (this.isSVG) {
            this.ctxMain.translate(this.scene.origin.x / (this.scene.scale * this.dpr), this.scene.origin.y / (this.scene.scale * this.dpr));
            this.ctxMain.globalAlpha = 1;
          } else if (this.ctxAboveLight) {
            this.ctxAboveLight.globalAlpha = 1;
          }
        }
        if (!this.isLightLayerSynced && shouldClearLightLayer && this.canvasRendererMain.flush) {
          this.canvasRendererMain.flush();
        }
        if (!skipLight) {
          this.pendingRays = [];
          this.processedRayCount = 0;
        }
        if (!skipGrid && this.ctxGrid) {
          this.canvasRendererGrid = new CanvasRenderer_default(this.ctxGrid, { x: this.scene.origin.x * this.dpr, y: this.scene.origin.y * this.dpr }, this.scene.scale * this.dpr, this.scene.lengthScale);
          if (this.scene.showGrid) {
            this.ctxGrid.save();
            this.ctxGrid.setTransform(this.scene.scale * this.dpr, 0, 0, this.scene.scale * this.dpr, 0, 0);
            var dashPattern = this.scene.theme.grid.dash.map((value) => value * this.scene.lengthScale);
            var dashPeriod = dashPattern.reduce((a, b) => a + b, 0);
            this.ctxGrid.strokeStyle = `rgb(${Math.round(this.scene.theme.grid.color.r * 255)},${Math.round(this.scene.theme.grid.color.g * 255)},${Math.round(this.scene.theme.grid.color.b * 255)},${this.scene.theme.grid.color.a})`;
            this.ctxGrid.lineWidth = this.scene.theme.grid.width * this.scene.lengthScale;
            if (dashPeriod * this.scene.scale <= 2) {
              dashPattern = [];
            }
            this.ctxGrid.setLineDash(dashPattern);
            this.ctxGrid.beginPath();
            for (var x = this.scene.origin.x / this.scene.scale % this.scene.gridSize; x <= this.ctxGrid.canvas.width / (this.scene.scale * this.dpr); x += this.scene.gridSize) {
              this.ctxGrid.moveTo(x, this.scene.origin.y / this.scene.scale % this.scene.gridSize - this.scene.gridSize);
              this.ctxGrid.lineTo(x, this.ctxGrid.canvas.height / (this.scene.scale * this.dpr));
            }
            this.ctxGrid.stroke();
            this.ctxGrid.beginPath();
            for (var y = this.scene.origin.y / this.scene.scale % this.scene.gridSize; y <= this.ctxGrid.canvas.height / (this.scene.scale * this.dpr); y += this.scene.gridSize) {
              this.ctxGrid.moveTo(this.scene.origin.x / this.scene.scale % this.scene.gridSize - this.scene.gridSize, y);
              this.ctxGrid.lineTo(this.ctxGrid.canvas.width / (this.scene.scale * this.dpr), y);
            }
            this.ctxGrid.stroke();
            this.ctxGrid.setLineDash([]);
            this.ctxGrid.restore();
          }
        }
        const hasDrawingCanvas = this.ctxBelowLight || this.canvasRendererMain;
        if (hasDrawingCanvas) {
          var mapped = this.scene.objs.map(function(obj, i2) {
            return { index: i2, value: obj.getZIndex() };
          });
          mapped.sort(function(a, b) {
            return a.value - b.value;
          });
          for (var j = 0; j < this.scene.objs.length; j++) {
            var i = mapped[j].index;
            var isHighlighted = this.scene.editor ? this.scene.editor.isObjHighlighted(i) : false;
            this.scene.objs[i].draw(!this.ctxBelowLight ? this.canvasRendererMain : this.canvasRendererBelowLight, false, isHighlighted);
          }
        }
        if (!skipLight) {
          for (let obj of this.scene.opticalObjs) {
            const ret = obj.onSimulationStart();
            if (ret) {
              if (ret.newRays) {
                for (let newRay of ret.newRays) {
                  if (newRay && newRay.depth == null) {
                    newRay.depth = 0;
                  }
                  this.pendingRays.push(newRay);
                }
              }
              if (ret.truncation) {
                this.totalTruncation += ret.truncation;
              }
              if (ret.brightnessScale) {
                if (this.brightnessScale == 0) {
                  this.brightnessScale = ret.brightnessScale;
                } else if (this.brightnessScale != ret.brightnessScale) {
                  this.brightnessScale = -1;
                }
              }
            }
          }
        }
        if (!skipLight) {
          this.leftRayCount = 0;
          this.last_s_obj_index = -1;
          this.last_ray = null;
          this.last_intersection = null;
          this.pendingRaysIndex = -1;
          this.firstBreak = true;
          this.processRays();
        }
        if (skipLight && hasDrawingCanvas) {
          var aboveLightRenderer = !this.ctxAboveLight ? this.canvasRendererMain : this.canvasRendererAboveLight;
          for (var i = 0; i < this.scene.objs.length; i++) {
            var isHighlighted = this.scene.editor ? this.scene.editor.isObjHighlighted(i) : false;
            this.scene.objs[i].draw(aboveLightRenderer, true, isHighlighted);
          }
          this.drawExternalHighlightPoints(aboveLightRenderer);
          if (this.scene.mode == "observer" && this.ctxAboveLight) {
            this.ctxAboveLight.globalAlpha = 1;
            this.ctxAboveLight.beginPath();
            this.ctxAboveLight.fillStyle = `rgb(${Math.round(this.scene.theme.observer.color.r * 255)},${Math.round(this.scene.theme.observer.color.g * 255)},${Math.round(this.scene.theme.observer.color.b * 255)})`;
            this.ctxAboveLight.arc(this.scene.observer.c.x, this.scene.observer.c.y, this.scene.observer.r, 0, Math.PI * 2, false);
            this.ctxAboveLight.fill();
          }
        }
        this.emit("requestUpdateErrorAndWarning");
      }
      /**
       * Process the rays in `this.pendingRays` during the simulation.
       * @returns {void}
       * @private
       */
      processRays() {
        this.simulationTimerId = -1;
        var st_time = /* @__PURE__ */ new Date();
        var alpha0 = 1;
        if (this.ctxMain) {
          this.ctxMain.globalAlpha = alpha0;
          if (this.scene.simulateColors) {
            this.ctxMain.globalCompositeOperation = "screen";
          } else {
            this.ctxMain.globalCompositeOperation = "source-over";
          }
        }
        var observed;
        var s_obj;
        var s_obj_index;
        var s_point;
        var s_point_temp;
        var s_lensq;
        var s_lensq_temp;
        var s_undefinedBehavior = false;
        var s_undefinedBehaviorObjs = [];
        var observed_point;
        var observed_intersection;
        var rpd;
        var surfaceMergingObjs = [];
        const opticalObjs = this.scene.opticalObjs;
        while (true) {
          if (/* @__PURE__ */ new Date() - st_time > 50 && this.enableTimer) {
            this.simulationTimerId = setTimeout(() => this.processRays(), this.firstBreak ? 100 : 1);
            this.firstBreak = false;
            if (this.scene.colorMode != "default" && this.canvasRendererMain) {
              this.canvasRendererMain.flush();
            }
            this.emit("simulationPause", null);
            this.updateSimulation(true, true);
            this.validate();
            return;
          }
          if (this.processedRayCount > this.rayCountLimit) {
            this.shouldSimulatorStop = true;
            break;
          }
          if (this.shouldSimulatorStop) break;
          if (this.pendingRaysIndex >= this.pendingRays.length) {
            if (this.leftRayCount == 0) {
              break;
            }
            this.leftRayCount = 0;
            this.last_s_obj_index = -1;
            this.last_ray = null;
            this.last_intersection = null;
            this.pendingRaysIndex = -1;
            continue;
          }
          this.pendingRaysIndex++;
          var j = this.pendingRaysIndex;
          if (this.pendingRays[j]) {
            s_obj = null;
            s_obj_index = -1;
            s_point = null;
            s_undefinedBehavior = false;
            s_undefinedBehaviorObjs = [];
            surfaceMergingObjs = [];
            s_lensq = Infinity;
            observed = false;
            for (var i = 0; i < opticalObjs.length; i++) {
              s_point_temp = opticalObjs[i].checkRayIntersects(this.pendingRays[j]);
              if (s_point_temp) {
                s_lensq_temp = geometry_default.distanceSquared(this.pendingRays[j].p1, s_point_temp);
                if (s_point && geometry_default.distanceSquared(s_point_temp, s_point) < _Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale && (opticalObjs[i] instanceof BaseGlass_default || s_obj instanceof BaseGlass_default)) {
                  if (s_obj instanceof BaseGlass_default) {
                    if (opticalObjs[i] instanceof BaseGlass_default) {
                      surfaceMergingObjs[surfaceMergingObjs.length] = opticalObjs[i];
                    } else {
                      if (!opticalObjs[i].constructor.mergesWithGlass) {
                        s_undefinedBehavior = true;
                        s_undefinedBehaviorObjs = [s_obj, opticalObjs[i]];
                      }
                      surfaceMergingObjs[surfaceMergingObjs.length] = s_obj;
                      s_obj = opticalObjs[i];
                      s_obj_index = i;
                      s_point = s_point_temp;
                      s_lensq = s_lensq_temp;
                    }
                  } else {
                    if (!s_obj.constructor.mergesWithGlass) {
                      s_undefinedBehavior = true;
                      s_undefinedBehaviorObjs = [s_obj, opticalObjs[i]];
                    }
                    surfaceMergingObjs[surfaceMergingObjs.length] = opticalObjs[i];
                  }
                } else {
                  if (s_point && geometry_default.distanceSquared(s_point_temp, s_point) < _Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale) {
                    s_undefinedBehavior = true;
                    s_undefinedBehaviorObjs = [s_obj, opticalObjs[i]];
                  } else if (s_lensq_temp < s_lensq && s_lensq_temp > _Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale) {
                    s_obj = opticalObjs[i];
                    s_obj_index = i;
                    s_point = s_point_temp;
                    s_lensq = s_lensq_temp;
                    s_undefinedBehavior = false;
                    s_undefinedBehaviorObjs = [];
                    surfaceMergingObjs = [];
                  }
                }
              }
            }
            if (s_undefinedBehavior) {
              this.declareUndefinedBehavior(this.pendingRays[j], s_undefinedBehaviorObjs);
            }
            if (this.canvasRendererMain) {
              if (this.scene.simulateColors) {
                var color = this.scene.simulator.wavelengthToColor(this.pendingRays[j].wavelength, this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p, !this.isSVG && this.scene.colorMode == "default");
              } else {
                var alpha = alpha0 * (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p);
              }
            }
            if (s_lensq == Infinity) {
              if (this.canvasRendererMain) {
                if (this.scene.mode == "rays" || this.scene.mode == "extended") {
                  if (this.scene.simulateColors) {
                    this.canvasRendererMain.drawRay(this.pendingRays[j], color, this.scene.showRayArrows, this.getThemeRayDash("colorRay"));
                  } else {
                    this.canvasRendererMain.drawRay(this.pendingRays[j], this.getThemeRayColor("ray", alpha), this.scene.showRayArrows, this.getThemeRayDash("ray"));
                  }
                }
                if (this.scene.mode == "extended" && !this.pendingRays[j].isNew) {
                  if (this.scene.simulateColors) {
                    this.canvasRendererMain.drawRay(geometry_default.line(this.pendingRays[j].p1, geometry_default.point(this.pendingRays[j].p1.x * 2 - this.pendingRays[j].p2.x, this.pendingRays[j].p1.y * 2 - this.pendingRays[j].p2.y)), color, void 0, this.getThemeRayDash("colorExtendedRay"));
                  } else {
                    this.canvasRendererMain.drawRay(geometry_default.line(this.pendingRays[j].p1, geometry_default.point(this.pendingRays[j].p1.x * 2 - this.pendingRays[j].p2.x, this.pendingRays[j].p1.y * 2 - this.pendingRays[j].p2.y)), this.getThemeRayColor("extendedRay", alpha), void 0, this.getThemeRayDash("extendedRay"));
                  }
                }
              }
              if (this.scene.mode == "observer") {
                observed_point = geometry_default.lineCircleIntersections(this.pendingRays[j], this.scene.observer)[2];
                if (observed_point) {
                  if (geometry_default.intersectionIsOnRay(observed_point, this.pendingRays[j])) {
                    observed = true;
                  }
                }
              }
            } else {
              if (this.canvasRendererMain) {
                if (this.scene.mode == "rays" || this.scene.mode == "extended") {
                  if (this.scene.simulateColors) {
                    this.canvasRendererMain.drawSegment(geometry_default.line(this.pendingRays[j].p1, s_point), color, this.scene.showRayArrows, this.getThemeRayDash("colorRay"));
                  } else {
                    this.canvasRendererMain.drawSegment(geometry_default.line(this.pendingRays[j].p1, s_point), this.getThemeRayColor("ray", alpha), this.scene.showRayArrows, this.getThemeRayDash("ray"));
                  }
                }
                if (this.scene.mode == "extended" && !this.pendingRays[j].isNew) {
                  if (this.scene.simulateColors) {
                    this.canvasRendererMain.drawRay(geometry_default.line(this.pendingRays[j].p1, geometry_default.point(this.pendingRays[j].p1.x * 2 - this.pendingRays[j].p2.x, this.pendingRays[j].p1.y * 2 - this.pendingRays[j].p2.y)), color, void 0, this.getThemeRayDash("colorExtendedRay"));
                    this.canvasRendererMain.drawRay(geometry_default.line(s_point, geometry_default.point(s_point.x * 2 - this.pendingRays[j].p1.x, s_point.y * 2 - this.pendingRays[j].p1.y)), color, void 0, this.getThemeRayDash("colorForwardExtendedRay"));
                  } else {
                    this.canvasRendererMain.drawRay(geometry_default.line(this.pendingRays[j].p1, geometry_default.point(this.pendingRays[j].p1.x * 2 - this.pendingRays[j].p2.x, this.pendingRays[j].p1.y * 2 - this.pendingRays[j].p2.y)), this.getThemeRayColor("extendedRay", alpha), void 0, this.getThemeRayDash("extendedRay"));
                    this.canvasRendererMain.drawRay(geometry_default.line(s_point, geometry_default.point(s_point.x * 2 - this.pendingRays[j].p1.x, s_point.y * 2 - this.pendingRays[j].p1.y)), this.getThemeRayColor("forwardExtendedRay", alpha), void 0, this.getThemeRayDash("forwardExtendedRay"));
                  }
                }
              }
              if (this.scene.mode == "observer") {
                observed_point = geometry_default.lineCircleIntersections(this.pendingRays[j], this.scene.observer)[2];
                if (observed_point) {
                  if (geometry_default.intersectionIsOnSegment(observed_point, geometry_default.line(this.pendingRays[j].p1, s_point))) {
                    observed = true;
                  }
                }
              }
            }
            if (this.scene.mode == "observer" && this.last_ray && this.canvasRendererMain) {
              if (!this.pendingRays[j].gap) {
                observed_intersection = geometry_default.linesIntersection(this.pendingRays[j], this.last_ray);
                if (observed) {
                  if (this.last_intersection && geometry_default.distanceSquared(this.last_intersection, observed_intersection) < 25 * this.scene.lengthScale * this.scene.lengthScale) {
                    if (geometry_default.intersectionIsOnRay(observed_intersection, geometry_default.line(observed_point, this.pendingRays[j].p1)) && geometry_default.distanceSquared(observed_point, this.pendingRays[j].p1) > 1e-5 * this.scene.lengthScale * this.scene.lengthScale) {
                      if (this.scene.simulateColors) {
                        var color = this.scene.simulator.wavelengthToColor(this.pendingRays[j].wavelength, (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p) * 0.5, !this.isSVG && this.scene.colorMode == "default");
                      } else {
                        const alpha2 = alpha0 * (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p + (this.last_ray.brightness_s + this.last_ray.brightness_p)) * 0.5;
                        this.ctxMain.globalAlpha = alpha2;
                      }
                      if (s_point) {
                        rpd = (observed_intersection.x - this.pendingRays[j].p1.x) * (s_point.x - this.pendingRays[j].p1.x) + (observed_intersection.y - this.pendingRays[j].p1.y) * (s_point.y - this.pendingRays[j].p1.y);
                      } else {
                        rpd = (observed_intersection.x - this.pendingRays[j].p1.x) * (this.pendingRays[j].p2.x - this.pendingRays[j].p1.x) + (observed_intersection.y - this.pendingRays[j].p1.y) * (this.pendingRays[j].p2.y - this.pendingRays[j].p1.y);
                      }
                      if (rpd < 0) {
                        if (this.scene.simulateColors) {
                          this.canvasRendererMain.drawPoint(observed_intersection, color, this.getThemeImageSize("colorVirtualImage"));
                        } else {
                          this.canvasRendererMain.drawPoint(observed_intersection, this.getThemeImageColor("virtualImage", alpha), this.getThemeImageSize("virtualImage"));
                        }
                      } else if (rpd < s_lensq) {
                        if (this.scene.simulateColors) {
                          this.canvasRendererMain.drawPoint(observed_intersection, color, this.getThemeImageSize("colorRealImage"));
                        } else {
                          this.canvasRendererMain.drawPoint(observed_intersection, this.getThemeImageColor("realImage", alpha), this.getThemeImageSize("realImage"));
                        }
                      }
                      if (this.scene.simulateColors) {
                        this.canvasRendererMain.drawSegment(geometry_default.line(observed_point, observed_intersection), color, void 0, this.getThemeRayDash("colorObservedRay"));
                      } else {
                        this.canvasRendererMain.drawSegment(geometry_default.line(observed_point, observed_intersection), this.getThemeRayColor("observedRay", alpha), void 0, this.getThemeRayDash("observedRay"));
                      }
                    } else {
                      if (this.scene.simulateColors) {
                        this.canvasRendererMain.drawRay(geometry_default.line(observed_point, this.pendingRays[j].p1), color, void 0, this.getThemeRayDash("colorObservedRay"));
                      } else {
                        this.canvasRendererMain.drawRay(geometry_default.line(observed_point, this.pendingRays[j].p1), this.getThemeRayColor("observedRay", alpha), void 0, this.getThemeRayDash("observedRay"));
                      }
                    }
                  } else {
                    if (this.last_intersection) {
                      if (this.scene.simulateColors) {
                        this.canvasRendererMain.drawRay(geometry_default.line(observed_point, this.pendingRays[j].p1), color, void 0, this.getThemeRayDash("colorObservedRay"));
                      } else {
                        this.canvasRendererMain.drawRay(geometry_default.line(observed_point, this.pendingRays[j].p1), this.getThemeRayColor("observedRay", alpha), void 0, this.getThemeRayDash("observedRay"));
                      }
                    }
                  }
                }
                this.last_intersection = observed_intersection;
              } else {
                this.last_intersection = null;
              }
            }
            if (this.scene.mode == "images" && this.last_ray && this.canvasRendererMain) {
              if (!this.pendingRays[j].gap) {
                observed_intersection = geometry_default.linesIntersection(this.pendingRays[j], this.last_ray);
                if (this.last_intersection && geometry_default.distanceSquared(this.last_intersection, observed_intersection) < 25 * this.scene.lengthScale * this.scene.lengthScale) {
                  if (this.scene.simulateColors) {
                    var color = this.scene.simulator.wavelengthToColor(this.pendingRays[j].wavelength, (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p) * 0.5, !this.isSVG && this.scene.colorMode == "default");
                  } else {
                    const alpha2 = alpha0 * (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p + (this.last_ray.brightness_s + this.last_ray.brightness_p)) * 0.5;
                    this.ctxMain.globalAlpha = alpha2;
                  }
                  if (s_point) {
                    rpd = (observed_intersection.x - this.pendingRays[j].p1.x) * (s_point.x - this.pendingRays[j].p1.x) + (observed_intersection.y - this.pendingRays[j].p1.y) * (s_point.y - this.pendingRays[j].p1.y);
                  } else {
                    rpd = (observed_intersection.x - this.pendingRays[j].p1.x) * (this.pendingRays[j].p2.x - this.pendingRays[j].p1.x) + (observed_intersection.y - this.pendingRays[j].p1.y) * (this.pendingRays[j].p2.y - this.pendingRays[j].p1.y);
                  }
                  if (rpd < 0) {
                    if (this.scene.simulateColors) {
                      this.canvasRendererMain.drawPoint(observed_intersection, color, this.getThemeImageSize("colorVirtualImage"));
                    } else {
                      this.canvasRendererMain.drawPoint(observed_intersection, this.getThemeImageColor("virtualImage", alpha), this.getThemeImageSize("virtualImage"));
                    }
                  } else if (rpd < s_lensq) {
                    if (this.scene.simulateColors) {
                      this.canvasRendererMain.drawPoint(observed_intersection, color, this.getThemeImageSize("colorRealImage"));
                    } else {
                      this.canvasRendererMain.drawPoint(observed_intersection, this.getThemeImageColor("realImage", alpha), this.getThemeImageSize("realImage"));
                    }
                  } else {
                    if (this.scene.simulateColors) {
                      this.canvasRendererMain.drawPoint(observed_intersection, color, this.getThemeImageSize("colorVirtualObject"));
                    } else {
                      this.canvasRendererMain.drawPoint(observed_intersection, this.getThemeImageColor("virtualObject", alpha), this.getThemeImageSize("virtualObject"));
                    }
                  }
                }
                this.last_intersection = observed_intersection;
              }
            }
            if (this.last_s_obj_index != s_obj_index) {
              this.pendingRays[j].gap = true;
            }
            this.pendingRays[j].isNew = false;
            this.last_ray = { p1: this.pendingRays[j].p1, p2: this.pendingRays[j].p2 };
            this.last_s_obj_index = s_obj_index;
            if (s_obj) {
              if (this.pendingRays[j].depth == null) {
                this.pendingRays[j].depth = 0;
              }
              this.pendingRays[j].depth += 1;
              const incidentDepth = this.pendingRays[j].depth;
              let maxRayDepth = this.scene.maxRayDepth;
              if (!Number.isFinite(maxRayDepth)) {
                maxRayDepth = Infinity;
              } else if (maxRayDepth < 0) {
                maxRayDepth = 0;
              }
              if (this.pendingRays[j].depth > maxRayDepth) {
                this.totalTruncation += (this.pendingRays[j].brightness_s || 0) + (this.pendingRays[j].brightness_p || 0);
                this.pendingRays[j] = null;
                this.processedRayCount = this.processedRayCount + 1;
                continue;
              }
              const ret = s_obj.onRayIncident(this.pendingRays[j], j, s_point, surfaceMergingObjs);
              if (ret) {
                if (ret.isUndefinedBehavior) {
                  this.declareUndefinedBehavior(this.pendingRays[j], [s_obj]);
                }
                if (ret.isAbsorbed) {
                  this.pendingRays[j] = null;
                }
                if (ret.newRays) {
                  for (let newRay of ret.newRays) {
                    if (newRay && newRay.depth == null) {
                      newRay.depth = incidentDepth;
                    }
                    this.pendingRays.push(newRay);
                  }
                }
                if (ret.truncation) {
                  this.totalTruncation += ret.truncation;
                }
              }
            } else {
              this.pendingRays[j] = null;
            }
            this.processedRayCount = this.processedRayCount + 1;
            if (this.pendingRays[j]) {
              this.leftRayCount = this.leftRayCount + 1;
            }
          }
        }
        if (this.canvasRendererMain) {
          if (this.scene.simulateColors && !this.isSVG) {
            this.canvasRendererMain.applyColorTransformation();
            if (this.ctxAboveLight) {
              this.ctxAboveLight.setTransform(this.scene.scale * this.dpr, 0, 0, this.scene.scale * this.dpr, this.scene.origin.x * this.dpr, this.scene.origin.y * this.dpr);
            }
          }
          if (this.scene.colorMode != "default") {
            this.canvasRendererMain.flush();
          }
          if (this.ctxMain) {
            this.ctxMain.globalAlpha = 1;
          }
        }
        this.updateSimulation(true, true);
        this.validate();
        if (this.shouldSimulatorStop) {
          this.emit("simulationStop", null);
          this.shouldSimulatorStop = false;
        } else {
          this.emit("simulationComplete", null);
        }
      }
      /**
       * Manually redraw the light layer.
       * @returns {void}
       */
      manualRedrawLightLayer() {
        this.updateSimulation(false, true, true);
      }
      /**
       * Stop the simulation.
       * @returns {void}
       */
      stopSimulation() {
        if (this.simulationTimerId != -1) {
          this.shouldSimulatorStop = true;
        }
      }
      /**
       * Declare that the ray encounters an undefined behavior due to the objects in `objs`.
       * @param {Ray} ray - The ray.
       * @param {BaseSceneObj[]} objs - The objects causing the undefined behavior.
       * @returns {void}
       */
      declareUndefinedBehavior(ray, objs) {
        this.totalUndefinedBehavior += ray.brightness_s + ray.brightness_p;
        if (this.undefinedBehaviorObjs.length == 0) {
          this.undefinedBehaviorObjs = objs;
        }
      }
      /**
       * Check the simulation and display warnings or errors if necessary.
       * @returns {void}
       */
      validate() {
        if (this.totalUndefinedBehavior > _Simulator.UNDEFINED_BEHAVIOR_THRESHOLD) {
          const involvedObjTypes = this.undefinedBehaviorObjs.map((obj) => obj.name || obj.constructor.type);
          if (involvedObjTypes.length == 1) {
            this.warning = instance.t("simulator:generalWarnings.undefinedBehaviorSingle", { involvedObj: involvedObjTypes[0] });
          } else {
            this.warning = instance.t("simulator:generalWarnings.undefinedBehaviorOverlapping", { involvedObj1: involvedObjTypes[0], involvedObj2: involvedObjTypes[1] });
          }
          return;
        }
        if (!this.scene.simulateColors && this.scene.colorMode !== "default" && !(this.scene.theme.background.color.r <= 0.01 && this.scene.theme.background.color.g <= 0.01 && this.scene.theme.background.color.b <= 0.01)) {
          const lightOptions = {
            rays: ["ray"],
            extended: ["ray", "extendedRay", "forwardExtendedRay"],
            images: ["realImage", "virtualImage", "virtualObject"],
            observer: ["realImage", "virtualImage", "observedRay"]
          }[this.scene.mode];
          for (let lightOption of lightOptions) {
            if (Math.max(this.scene.theme[lightOption].color.r, this.scene.theme[lightOption].color.g, this.scene.theme[lightOption].color.b) < 0.99) {
              this.warning = instance.t("simulator:generalWarnings.blackBecomesTransparent");
              return;
            }
          }
        }
        if (this.brightnessScale == -1) {
          let hasDetector = false;
          for (let obj of this.scene.opticalObjs) {
            if (obj instanceof Detector) {
              hasDetector = true;
              break;
            }
          }
          if (hasDetector || this.scene.simulateColors) {
            this.warning = instance.t("simulator:generalWarnings.brightnessInconsistent");
          } else {
            this.warning = null;
          }
        } else {
          this.warning = null;
        }
      }
      wavelengthToColor(wavelength, brightness, transform) {
        var R, G, B, alpha, wl = wavelength;
        const baseViolet = _Simulator.VIOLET_WAVELENGTH;
        const baseRed = _Simulator.RED_WAVELENGTH;
        const sceneViolet = this.scene && Number.isFinite(this.scene.violetWavelength) ? this.scene.violetWavelength : baseViolet;
        const sceneRed = this.scene && Number.isFinite(this.scene.redWavelength) ? this.scene.redWavelength : baseRed;
        const targetViolet = sceneRed > sceneViolet ? sceneViolet : baseViolet;
        const targetRed = sceneRed > sceneViolet ? sceneRed : baseRed;
        const scale = (targetRed - targetViolet) / (baseRed - baseViolet);
        const scaled = (x) => targetViolet + (x - baseViolet) * scale;
        const UV_WAVELENGTH = scaled(_Simulator.UV_WAVELENGTH);
        const VIOLET_WAVELENGTH = targetViolet;
        const BLUE_WAVELENGTH = scaled(_Simulator.BLUE_WAVELENGTH);
        const CYAN_WAVELENGTH = scaled(_Simulator.CYAN_WAVELENGTH);
        const GREEN_WAVELENGTH = scaled(_Simulator.GREEN_WAVELENGTH);
        const YELLOW_WAVELENGTH = scaled(_Simulator.YELLOW_WAVELENGTH);
        const RED_WAVELENGTH = targetRed;
        const INFRARED_WAVELENGTH = scaled(_Simulator.INFRARED_WAVELENGTH);
        const keepNonVisibleLight = Boolean(
          this.scene?.keepNonVisibleLight && Number.isFinite(wl) && wl > 0
        );
        if (keepNonVisibleLight && wl < VIOLET_WAVELENGTH || wl >= UV_WAVELENGTH && wl < VIOLET_WAVELENGTH) {
          R = 0.5;
          G = 0;
          B = 1;
        } else if (wl >= VIOLET_WAVELENGTH && wl < BLUE_WAVELENGTH) {
          R = -0.5 * (wl - BLUE_WAVELENGTH) / (BLUE_WAVELENGTH - VIOLET_WAVELENGTH);
          G = 0;
          B = 1;
        } else if (wl >= BLUE_WAVELENGTH && wl < CYAN_WAVELENGTH) {
          R = 0;
          G = (wl - BLUE_WAVELENGTH) / (CYAN_WAVELENGTH - BLUE_WAVELENGTH);
          B = 1;
        } else if (wl >= CYAN_WAVELENGTH && wl < GREEN_WAVELENGTH) {
          R = 0;
          G = 1;
          B = -1 * (wl - GREEN_WAVELENGTH) / (GREEN_WAVELENGTH - CYAN_WAVELENGTH);
        } else if (wl >= GREEN_WAVELENGTH && wl < YELLOW_WAVELENGTH) {
          R = (wl - GREEN_WAVELENGTH) / (YELLOW_WAVELENGTH - GREEN_WAVELENGTH);
          G = 1;
          B = 0;
        } else if (wl >= YELLOW_WAVELENGTH && wl < RED_WAVELENGTH) {
          R = 1;
          G = -1 * (wl - RED_WAVELENGTH) / (RED_WAVELENGTH - YELLOW_WAVELENGTH);
          B = 0;
        } else if (wl >= RED_WAVELENGTH && (keepNonVisibleLight || wl <= INFRARED_WAVELENGTH)) {
          R = 1;
          G = 0;
          B = 0;
        } else {
          R = 0;
          G = 0;
          B = 0;
        }
        const FADE_LIMIT = keepNonVisibleLight ? 0.25 : 0;
        if (wl > INFRARED_WAVELENGTH || wl < UV_WAVELENGTH) {
          alpha = FADE_LIMIT;
        } else if (wl > RED_WAVELENGTH) {
          alpha = keepNonVisibleLight ? 1 - (1 - FADE_LIMIT) * (wl - RED_WAVELENGTH) / (INFRARED_WAVELENGTH - RED_WAVELENGTH) : (INFRARED_WAVELENGTH - wl) / (INFRARED_WAVELENGTH - RED_WAVELENGTH);
        } else if (wl < VIOLET_WAVELENGTH) {
          alpha = keepNonVisibleLight ? 1 - (1 - FADE_LIMIT) * (VIOLET_WAVELENGTH - wl) / (VIOLET_WAVELENGTH - UV_WAVELENGTH) : (wl - UV_WAVELENGTH) / (VIOLET_WAVELENGTH - UV_WAVELENGTH);
        } else {
          alpha = 1;
        }
        R *= alpha * brightness;
        G *= alpha * brightness;
        B *= alpha * brightness;
        if (transform) {
          R = 1 - Math.exp(-R);
          G = 1 - Math.exp(-G);
          B = 1 - Math.exp(-B);
        }
        return [R, G, B, 1];
      }
    };
    Simulator_default = Simulator;
  }
});

// app/notices/ray-optics/source/sceneObjs/lightSource/SingleRay.js
var SingleRay_exports = {};
__export(SingleRay_exports, {
  default: () => SingleRay_default
});
var SINGLE_RAY_SOURCE_TYPE, SingleRay, SingleRay_default;
var init_SingleRay = __esm({
  "app/notices/ray-optics/source/sceneObjs/lightSource/SingleRay.js"() {
    "use strict";
    init_BaseSceneObj();
    init_LineObjMixin();
    init_Simulator();
    init_geometry();
    init_formula_parser();
    init_i18next();
    SINGLE_RAY_SOURCE_TYPE = {
      name: "Single ray",
      paramNames: ["x_0", "y_0", "d_x_0", "d_y_0", "P", "lambda_0"],
      dag: parseFormula(
        `
      x = x_0;
      y = y_0;
      d_x = d_x_0;
      d_y = d_y_0;
      P_s = P;
      P_p = P;
      lambda = lambda_0;
    `,
        ["x_0", "y_0", "d_x_0", "d_y_0", "P", "lambda_0"]
      )
    };
    SingleRay = class extends LineObjMixin_default(BaseSceneObj_default) {
      static type = "SingleRay";
      static isOptical = true;
      static serializableDefaults = {
        p1: null,
        p2: null,
        brightness: 1,
        wavelength: Simulator_default.GREEN_WAVELENGTH
      };
      static getDescription(objData, scene, detailed = false) {
        return instance.t("main:tools.SingleRay.title");
      }
      static getPropertySchema(objData, scene) {
        return [
          { key: "p1", type: "point", label: instance.t("simulator:sceneObjs.LineObjMixin.sourcePoint") },
          { key: "p2", type: "point", label: instance.t("simulator:sceneObjs.LineObjMixin.directionPoint") },
          { key: "brightness", type: "number", label: instance.t("simulator:sceneObjs.common.brightness") },
          { key: "wavelength", type: "number", label: instance.t("simulator:sceneObjs.common.wavelength") + " (nm)" }
        ];
      }
      populateObjBar(objBar) {
        objBar.setTitle(instance.t("main:tools.SingleRay.title"));
        objBar.createNumber(instance.t("simulator:sceneObjs.common.brightness"), 0.01, 1, 0.01, this.brightness, function(obj, value) {
          obj.brightness = value;
        });
        if (this.scene.simulateColors) {
          objBar.createNumber(instance.t("simulator:sceneObjs.common.wavelength") + " (nm)", Simulator_default.UV_WAVELENGTH, Simulator_default.INFRARED_WAVELENGTH, 1, this.wavelength, function(obj, value) {
            obj.wavelength = value;
          });
        }
      }
      draw(canvasRenderer, isAboveLight, isHovered) {
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        let sourceColor = this.scene.theme.sourcePoint.color;
        let directionColor = this.scene.theme.directionPoint.color;
        if (this.scene.simulateColors) {
          sourceColor = this.scene.simulator.wavelengthToColor(this.wavelength, 1);
        }
        if (isHovered) {
          sourceColor = this.scene.highlightColor;
          directionColor = this.scene.highlightColor;
        }
        canvasRenderer.drawPoint(this.p1, sourceColor, this.scene.theme.sourcePoint.size);
        canvasRenderer.drawPoint(this.p2, directionColor, this.scene.theme.directionPoint.size);
      }
      getDefaultCenter() {
        return this.p1;
      }
      getPrimitives() {
        if (!this.p1 || !this.p2) return [];
        const directionX = this.p2.x - this.p1.x;
        const directionY = this.p2.y - this.p1.y;
        const directionLength = Math.hypot(directionX, directionY);
        if (!(directionLength > 0) || !Number.isFinite(directionLength)) {
          return [];
        }
        return [{
          kind: "source",
          sourceType: SINGLE_RAY_SOURCE_TYPE,
          params: {
            x_0: this.p1.x,
            y_0: this.p1.y,
            d_x_0: directionX / directionLength,
            d_y_0: directionY / directionLength,
            P: 0.5 * this.brightness,
            lambda_0: this.scene.simulateColors ? this.wavelength : Simulator_default.GREEN_WAVELENGTH
          },
          rayCount: 1
        }];
      }
      onSimulationStart() {
        var ray1 = geometry_default.line(this.p1, this.p2);
        ray1.brightness_s = 0.5 * this.brightness;
        ray1.brightness_p = 0.5 * this.brightness;
        if (this.scene.simulateColors) {
          ray1.wavelength = this.wavelength;
        }
        ray1.gap = true;
        ray1.isNew = true;
        return {
          newRays: [ray1]
        };
      }
    };
    SingleRay_default = SingleRay;
  }
});

// app/notices/ray-optics/source/sceneObjs/lightSource/Beam.js
var Beam_exports = {};
__export(Beam_exports, {
  default: () => Beam_default
});
var BEAM_POINT_SOURCE_TYPE, PARALLEL_BEAM_SOURCE_TYPE, RANDOM_BEAM_RAY_SOURCE_TYPE, Beam, Beam_default;
var init_Beam = __esm({
  "app/notices/ray-optics/source/sceneObjs/lightSource/Beam.js"() {
    "use strict";
    init_BaseSceneObj();
    init_LineObjMixin();
    init_Simulator();
    init_geometry();
    init_i18next();
    init_formula_parser();
    BEAM_POINT_SOURCE_TYPE = {
      name: "Beam point",
      paramNames: [
        "x_0",
        "y_0",
        "normal",
        "delta_angle",
        "P",
        "lambert",
        "lambda_0"
      ],
      dag: parseFormula(
        `
      pair = floor((i + 1) / 2);
      parity = i - 2 * floor(i / 2);
      angle = pair * delta_angle * (2 * parity - 1);
      x = x_0;
      y = y_0;
      d_x = sin(normal + angle);
      d_y = cos(normal + angle);
      P_s = P * (1 - lambert + lambert * cos(angle));
      P_p = P * (1 - lambert + lambert * cos(angle));
      lambda = lambda_0;
    `,
        [
          "i",
          "x_0",
          "y_0",
          "normal",
          "delta_angle",
          "P",
          "lambert",
          "lambda_0"
        ]
      )
    };
    PARALLEL_BEAM_SOURCE_TYPE = {
      name: "Parallel beam",
      paramNames: [
        "x_0",
        "y_0",
        "step_x",
        "step_y",
        "d_x_0",
        "d_y_0",
        "P",
        "lambda_0"
      ],
      dag: parseFormula(
        `
      x = x_0 + i * step_x;
      y = y_0 + i * step_y;
      d_x = d_x_0;
      d_y = d_y_0;
      P_s = P;
      P_p = P;
      lambda = lambda_0;
    `,
        [
          "i",
          "x_0",
          "y_0",
          "step_x",
          "step_y",
          "d_x_0",
          "d_y_0",
          "P",
          "lambda_0"
        ]
      )
    };
    RANDOM_BEAM_RAY_SOURCE_TYPE = {
      name: "Random beam ray",
      paramNames: ["x_0", "y_0", "d_x_0", "d_y_0", "P_s_0", "P_p_0", "lambda_0"],
      dag: parseFormula(
        `
      x = x_0;
      y = y_0;
      d_x = d_x_0;
      d_y = d_y_0;
      P_s = P_s_0;
      P_p = P_p_0;
      lambda = lambda_0;
    `,
        ["x_0", "y_0", "d_x_0", "d_y_0", "P_s_0", "P_p_0", "lambda_0"]
      )
    };
    Beam = class extends LineObjMixin_default(BaseSceneObj_default) {
      static type = "Beam";
      static isOptical = true;
      static serializableDefaults = {
        p1: null,
        p2: null,
        brightness: 0.5,
        wavelength: Simulator_default.GREEN_WAVELENGTH,
        emisAngle: 0,
        lambert: false,
        random: false
      };
      static getDescription(objData, scene, detailed = false) {
        return instance.t("main:tools.Beam.title");
      }
      static getPropertySchema(objData, scene) {
        return [
          ...super.getPropertySchema(objData, scene),
          { key: "brightness", type: "number", label: instance.t("simulator:sceneObjs.common.brightness") },
          { key: "wavelength", type: "number", label: instance.t("simulator:sceneObjs.common.wavelength") + " (nm)" },
          { key: "emisAngle", type: "number", label: instance.t("simulator:sceneObjs.common.emisAngle") + " (\xB0)" },
          { key: "lambert", type: "boolean", label: instance.t("simulator:sceneObjs.common.lambert") },
          { key: "random", type: "boolean", label: instance.t("simulator:sceneObjs.common.random") }
        ];
      }
      populateObjBar(objBar) {
        if (this.scene.colorMode !== "default") {
          var brightnessInfo = instance.t("simulator:sceneObjs.common.brightnessInfo.newColorModes");
        } else {
          var brightnessInfo = "<p>" + instance.t("simulator:sceneObjs.common.brightnessInfo.rayDensity") + "</p><p>" + instance.t("simulator:sceneObjs.common.brightnessInfo.rayDensitySlider") + "</p>";
        }
        objBar.setTitle(instance.t("main:tools.Beam.title"));
        objBar.createNumber(instance.t("simulator:sceneObjs.common.brightness"), 0.01 / this.scene.lengthScale, 1 / this.scene.lengthScale, 0.01 / this.scene.lengthScale, this.brightness, function(obj, value) {
          obj.brightness = value;
        }, brightnessInfo);
        if (this.scene.simulateColors) {
          objBar.createNumber(instance.t("simulator:sceneObjs.common.wavelength") + " (nm)", Simulator_default.UV_WAVELENGTH, Simulator_default.INFRARED_WAVELENGTH, 1, this.wavelength, function(obj, value) {
            obj.wavelength = value;
          });
        }
        if (objBar.showAdvanced(!this.arePropertiesDefault(["emisAngle", "lambert", "random"]))) {
          objBar.createNumber(instance.t("simulator:sceneObjs.common.emisAngle") + " (\xB0)", 0, 180, 1, this.emisAngle, function(obj, value) {
            obj.emisAngle = value;
          });
          objBar.createBoolean(instance.t("simulator:sceneObjs.common.lambert"), this.lambert, function(obj, value) {
            obj.lambert = value;
          });
          objBar.createBoolean(instance.t("simulator:sceneObjs.common.random"), this.random, function(obj, value) {
            obj.random = value;
          });
        }
      }
      onConstructMouseDown(mouse, ctrl, shift) {
        super.onConstructMouseDown(mouse, ctrl, shift);
        if (this.scene.colorMode !== "default") {
          this.brightness = 0.1;
        }
      }
      draw(canvasRenderer, isAboveLight, isHovered) {
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
          ctx.fillStyle = "rgb(128,128,128)";
          ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
          return;
        }
        var a_l = Math.atan2(this.p1.x - this.p2.x, this.p1.y - this.p2.y) - Math.PI / 2;
        const colorArray = this.scene.simulator.wavelengthToColor(this.wavelength, 1);
        ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.simulateColors ? colorArray : this.scene.theme.lightSource.color);
        ctx.lineWidth = this.scene.theme.lightSource.size * 4 / 5 * ls;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.moveTo(this.p1.x + Math.sin(a_l) * this.scene.theme.lightSource.size * 2 / 5 * ls, this.p1.y + Math.cos(a_l) * this.scene.theme.lightSource.size * 2 / 5 * ls);
        ctx.lineTo(this.p2.x + Math.sin(a_l) * this.scene.theme.lightSource.size * 2 / 5 * ls, this.p2.y + Math.cos(a_l) * this.scene.theme.lightSource.size * 2 / 5 * ls);
        ctx.stroke();
        ctx.strokeStyle = canvasRenderer.rgbaToCssColor(this.scene.theme.beamShield.color);
        ctx.lineWidth = this.scene.theme.beamShield.width * ls;
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
        ctx.lineWidth = 1 * ls;
        ctx.lineCap = "butt";
      }
      scale(scale, center) {
        super.scale(scale, center);
        this.brightness /= scale;
        return true;
      }
      getPrimitives() {
        this.brightnessScale = null;
        if (!this.p1 || !this.p2) return [];
        const length = geometry_default.segmentLength(this);
        if (!(length > 0) || !Number.isFinite(length)) return [];
        let rayDensity = this.scene.rayDensity;
        let positionCount;
        let randomRayCount;
        let angleStep;
        let angularCount;
        let rayPower;
        let expectedBrightness;
        do {
          const n = length * rayDensity / this.scene.lengthScale;
          positionCount = Math.max(0, Math.floor(n + 0.5));
          const angularSamples = parseInt(rayDensity * 500);
          if (!(angularSamples > 0)) return [];
          angleStep = Math.PI * 2 / angularSamples;
          const halfAngle = this.emisAngle / 180 * Math.PI * 0.5;
          angularCount = 1;
          for (let angle = angleStep; angle < halfAngle; angle += angleStep) {
            angularCount += 2;
          }
          const brightnessFactor = 1 / (1 + Math.floor(halfAngle / angleStep) * 2);
          expectedBrightness = this.brightness * this.scene.lengthScale / rayDensity * brightnessFactor;
          rayPower = Math.min(expectedBrightness, 1) * 0.5;
          randomRayCount = Math.max(
            0,
            Math.ceil(n * (1 + Math.floor(halfAngle / angleStep) * 2))
          );
          if (this.scene.colorMode !== "default" && expectedBrightness > 1) {
            rayDensity += 1 / 500;
          } else {
            break;
          }
        } while (true);
        const dx = this.p2.x - this.p1.x;
        const dy = this.p2.y - this.p1.y;
        const normal = Math.atan2(dx, dy) + Math.PI / 2;
        const wavelength = this.scene.simulateColors ? this.wavelength : Simulator_default.GREEN_WAVELENGTH;
        if (this.scene.colorMode === "default") {
          this.brightnessScale = Math.min(expectedBrightness, 1) / expectedBrightness;
        }
        if (this.random) {
          this.initRandom();
          const halfAngle = this.emisAngle / 180 * Math.PI * 0.5;
          const primitives2 = [];
          for (let i = 0; i < randomRayCount; i++) {
            const position = this.getRandom(i * 2);
            const angle = (this.getRandom(i * 2 + 1) * 2 - 1) * halfAngle;
            const power = rayPower * (this.lambert ? Math.cos(angle) : 1);
            primitives2.push({
              kind: "source",
              sourceType: RANDOM_BEAM_RAY_SOURCE_TYPE,
              params: {
                x_0: this.p1.x + position * dx,
                y_0: this.p1.y + position * dy,
                d_x_0: Math.sin(normal + angle),
                d_y_0: Math.cos(normal + angle),
                P_s_0: power,
                P_p_0: power,
                lambda_0: wavelength
              },
              rayCount: 1
            });
          }
          return primitives2;
        }
        const stepX = dx / (length * rayDensity / this.scene.lengthScale);
        const stepY = dy / (length * rayDensity / this.scene.lengthScale);
        if (angularCount === 1) {
          return [{
            kind: "source",
            sourceType: PARALLEL_BEAM_SOURCE_TYPE,
            params: {
              x_0: this.p1.x + 0.5 * stepX,
              y_0: this.p1.y + 0.5 * stepY,
              step_x: stepX,
              step_y: stepY,
              d_x_0: Math.sin(normal),
              d_y_0: Math.cos(normal),
              P: rayPower,
              lambda_0: wavelength
            },
            rayCount: positionCount
          }];
        }
        const primitives = [];
        for (let positionIndex = 0; positionIndex < positionCount; positionIndex++) {
          const position = positionIndex + 0.5;
          primitives.push({
            kind: "source",
            sourceType: BEAM_POINT_SOURCE_TYPE,
            params: {
              x_0: this.p1.x + position * stepX,
              y_0: this.p1.y + position * stepY,
              normal,
              delta_angle: angleStep,
              P: rayPower,
              lambert: this.lambert ? 1 : 0,
              lambda_0: wavelength
            },
            rayCount: angularCount
          });
        }
        return primitives;
      }
      onSimulationStart() {
        if ((this.scene.mode == "images" || this.scene.mode == "observer") && (this.emisAngle > 0 || this.random)) {
          this.warning = instance.t("simulator:sceneObjs.Beam.imageDetectionWarning");
        } else {
          this.warning = null;
        }
        let rayDensity = this.scene.rayDensity;
        do {
          var n = geometry_default.segmentLength(this) * rayDensity / this.scene.lengthScale;
          var stepX = (this.p2.x - this.p1.x) / n;
          var stepY = (this.p2.y - this.p1.y) / n;
          var s = Math.PI * 2 / parseInt(rayDensity * 500);
          var sizeX = this.p2.x - this.p1.x;
          var sizeY = this.p2.y - this.p1.y;
          var normal = Math.atan2(stepX, stepY) + Math.PI / 2;
          var halfAngle = this.emisAngle / 180 * Math.PI * 0.5;
          var numnAngledRays = 1 + Math.floor(halfAngle / s) * 2;
          var rayBrightness = 1 / numnAngledRays;
          var expectBrightness = this.brightness * this.scene.lengthScale / rayDensity * rayBrightness;
          if (this.scene.colorMode !== "default" && expectBrightness > 1) {
            rayDensity += 1 / 500;
          }
        } while (this.scene.colorMode !== "default" && expectBrightness > 1);
        this.initRandom();
        let newRays = [];
        if (!this.random) {
          for (var i = 0.5; i <= n; i++) {
            var x = this.p1.x + i * stepX;
            var y = this.p1.y + i * stepY;
            newRays.push(this.newRay(x, y, normal, 0, i == 0, rayBrightness, rayDensity));
            for (var angle = s; angle < halfAngle; angle += s) {
              newRays.push(this.newRay(x, y, normal, angle, i == 0, rayBrightness, rayDensity));
              newRays.push(this.newRay(x, y, normal, -angle, i == 0, rayBrightness, rayDensity));
            }
          }
        } else {
          for (var i = 0; i < n * numnAngledRays; i++) {
            const position = this.getRandom(i * 2);
            const angle2 = this.getRandom(i * 2 + 1);
            newRays.push(this.newRay(
              this.p1.x + position * sizeX,
              this.p1.y + position * sizeY,
              normal,
              (angle2 * 2 - 1) * halfAngle,
              i == 0,
              rayBrightness,
              rayDensity
            ));
          }
        }
        return {
          newRays,
          brightnessScale: Math.min(this.brightness * this.scene.lengthScale / rayDensity * rayBrightness, 1) / (this.brightness * this.scene.lengthScale / rayDensity * rayBrightness)
        };
      }
      /** Utility methods */
      initRandom() {
        if (this.randomNumbers == void 0 || !this.random) {
          this.clearRandom();
        }
      }
      clearRandom() {
        this.randomNumbers = [];
      }
      getRandom(i) {
        for (let j = this.randomNumbers.length; j <= i; j++) {
          this.randomNumbers.push(this.scene.rng());
        }
        return this.randomNumbers[i];
      }
      newRay(x, y, normal, angle, gap, brightness_factor = 1, rayDensity = this.scene.rayDensity) {
        var ray1 = geometry_default.line(geometry_default.point(x, y), geometry_default.point(x + Math.sin(normal + angle), y + Math.cos(normal + angle)));
        ray1.brightness_s = Math.min(this.brightness * this.scene.lengthScale / rayDensity * brightness_factor, 1) * 0.5;
        ray1.brightness_p = Math.min(this.brightness * this.scene.lengthScale / rayDensity * brightness_factor, 1) * 0.5;
        if (this.lambert) {
          const lambert = Math.cos(angle);
          ray1.brightness_s *= lambert;
          ray1.brightness_p *= lambert;
        }
        ray1.isNew = true;
        if (this.scene.simulateColors) {
          ray1.wavelength = this.wavelength;
        }
        ray1.gap = gap;
        return ray1;
      }
    };
    Beam_default = Beam;
  }
});

// app/notices/ray-optics/source/sceneObjs/BaseFilter.js
var MIRROR_SURFACE_TYPE, ABSORBER_SURFACE_TYPE, BaseFilter, BaseFilter_default;
var init_BaseFilter = __esm({
  "app/notices/ray-optics/source/sceneObjs/BaseFilter.js"() {
    "use strict";
    init_BaseSceneObj();
    init_Simulator();
    init_i18next();
    init_formula_parser();
    MIRROR_SURFACE_TYPE = {
      name: "Mirror",
      paramNames: [],
      dag: parseFormula(
        "d_1x = d_0x; d_1y = -d_0y; P_1s = P_0s; P_1p = P_0p",
        ["d_0x", "d_0y", "P_0s", "P_0p"]
      ),
      outRayCount: 1,
      mergesWithBoundary: true
    };
    ABSORBER_SURFACE_TYPE = {
      name: "Absorber",
      paramNames: [],
      dag: parseFormula(
        "d_1x = d_0x; d_1y = d_0y; P_1s = 0; P_1p = 0",
        ["d_0x", "d_0y"]
      ),
      outRayCount: 1,
      mergesWithBoundary: true
    };
    BaseFilter = class extends BaseSceneObj_default {
      static MIRROR_SURFACE_TYPE = MIRROR_SURFACE_TYPE;
      static ABSORBER_SURFACE_TYPE = ABSORBER_SURFACE_TYPE;
      static getPropertySchema(objData, scene) {
        return [
          { key: "filter", type: "boolean", label: instance.t("simulator:sceneObjs.BaseFilter.filter") },
          { key: "invert", type: "boolean", label: instance.t("simulator:sceneObjs.BaseFilter.invert") },
          { key: "wavelength", type: "number", label: instance.t("simulator:sceneObjs.common.wavelength") + " (nm)" },
          { key: "bandwidth", type: "number", label: instance.t("simulator:sceneObjs.BaseFilter.bandwidth") + " (nm)" }
        ];
      }
      populateObjBar(objBar) {
        if (this.scene.simulateColors) {
          objBar.createBoolean(instance.t("simulator:sceneObjs.BaseFilter.filter"), this.filter, function(obj, value) {
            obj.filter = value;
            obj.wavelength = obj.wavelength;
            obj.invert = obj.invert;
            obj.bandwidth = obj.bandwidth;
          }, null, true);
          if (this.filter) {
            objBar.createBoolean(instance.t("simulator:sceneObjs.BaseFilter.invert"), this.invert, function(obj, value) {
              if (obj.filter) {
                obj.invert = value;
              }
            });
            objBar.createNumber(instance.t("simulator:sceneObjs.common.wavelength") + " (nm)", Simulator_default.UV_WAVELENGTH, Simulator_default.INFRARED_WAVELENGTH, 1, this.wavelength, function(obj, value) {
              obj.wavelength = value;
            });
            objBar.createNumber("\xB1 " + instance.t("simulator:sceneObjs.BaseFilter.bandwidth") + " (nm)", 0, Simulator_default.INFRARED_WAVELENGTH - Simulator_default.UV_WAVELENGTH, 1, this.bandwidth, function(obj, value) {
              obj.bandwidth = value;
            });
          }
        }
      }
      /**
       * Checks if the ray interacts with the filter at the level of the wavelength.
       * @param {Ray} ray - The ray to be checked.
       * @returns {boolean} - If true, the ray interacts with the filter at the level of the wavelength.
       */
      checkRayIntersectFilter(ray) {
        var dichroicEnabled = this.scene.simulateColors && this.filter && this.wavelength;
        var rayHueMatchesMirror = Math.abs(this.wavelength - ray.wavelength) <= this.bandwidth;
        return !dichroicEnabled || rayHueMatchesMirror != this.invert;
      }
      /**
       * Return this object's wavelength filter in the primitive format.
       * @returns {WavelengthFilter|null} The enabled filter, or null.
       */
      getPrimitiveWavelengthFilter() {
        if (!(this.scene.simulateColors && this.filter && this.wavelength)) {
          return null;
        }
        return {
          wavelength: this.wavelength,
          bandwidth: this.bandwidth,
          invert: this.invert
        };
      }
      /**
       * Build a two-sided ideal-mirror primitive for the supplied curve.
       * @param {PrimitiveCurve} curve - The mirror curve.
       * @returns {SurfacePrimitive} The mirror surface primitive.
       */
      createMirrorPrimitive(curve) {
        const primitive = {
          kind: "surface",
          curve,
          twoSided: true,
          surfaceType: MIRROR_SURFACE_TYPE,
          params: {}
        };
        const filter = this.getPrimitiveWavelengthFilter();
        if (filter) {
          primitive.filter = filter;
        }
        return primitive;
      }
      /**
       * Build a two-sided absorbing primitive for the supplied curve.
       * @param {PrimitiveCurve} curve
       * @param {boolean} [withFilter=true]
       * @returns {SurfacePrimitive}
       */
      createAbsorberPrimitive(curve, withFilter = true) {
        const primitive = {
          kind: "surface",
          curve,
          twoSided: true,
          surfaceType: ABSORBER_SURFACE_TYPE,
          params: {}
        };
        const filter = withFilter ? this.getPrimitiveWavelengthFilter() : null;
        if (filter) primitive.filter = filter;
        return primitive;
      }
    };
    BaseFilter_default = BaseFilter;
  }
});

// app/notices/ray-optics/source/sceneObjs/mirror/Mirror.js
var Mirror_exports = {};
__export(Mirror_exports, {
  default: () => Mirror_default
});
var Mirror, Mirror_default;
var init_Mirror = __esm({
  "app/notices/ray-optics/source/sceneObjs/mirror/Mirror.js"() {
    "use strict";
    init_BaseFilter();
    init_LineObjMixin();
    init_i18next();
    init_Simulator();
    init_geometry();
    Mirror = class extends LineObjMixin_default(BaseFilter_default) {
      static type = "Mirror";
      static isOptical = true;
      static mergesWithGlass = true;
      static serializableDefaults = {
        p1: null,
        p2: null,
        filter: false,
        invert: false,
        wavelength: Simulator_default.GREEN_WAVELENGTH,
        bandwidth: 10
      };
      static getDescription(objData, scene, detailed = false) {
        return instance.t("main:meta.parentheses", { main: instance.t("main:tools.categories.mirror"), sub: instance.t("main:tools.Mirror.title") });
      }
      static getPropertySchema(objData, scene) {
        return [
          ...super.getPropertySchema(objData, scene)
        ];
      }
      populateObjBar(objBar) {
        objBar.setTitle(instance.t("main:meta.parentheses", { main: instance.t("main:tools.categories.mirror"), sub: instance.t("main:tools.Mirror.title") }));
        super.populateObjBar(objBar);
      }
      draw(canvasRenderer, isAboveLight, isHovered) {
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
          ctx.fillStyle = "rgb(128,128,128)";
          ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
          return;
        }
        const colorArray = this.scene.simulator.wavelengthToColor(this.wavelength || Simulator_default.GREEN_WAVELENGTH, 1);
        ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.simulateColors && this.wavelength && this.filter ? colorArray : this.scene.theme.mirror.color);
        ctx.lineWidth = this.scene.theme.mirror.width * ls;
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
      }
      getPrimitives() {
        if (!this.p1 || !this.p2 || this.p1.x === this.p2.x && this.p1.y === this.p2.y) {
          return [];
        }
        return [this.createMirrorPrimitive({
          kind: "lineSegment",
          params: {
            start: { x: this.p1.x, y: this.p1.y },
            end: { x: this.p2.x, y: this.p2.y }
          }
        })];
      }
      checkRayIntersects(ray) {
        if (this.checkRayIntersectFilter(ray)) {
          return this.checkRayIntersectsShape(ray);
        } else {
          return null;
        }
      }
      onRayIncident(ray, rayIndex, incidentPoint) {
        var rx = ray.p1.x - incidentPoint.x;
        var ry = ray.p1.y - incidentPoint.y;
        var mx = this.p2.x - this.p1.x;
        var my = this.p2.y - this.p1.y;
        ray.p1 = incidentPoint;
        ray.p2 = geometry_default.point(incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
      }
    };
    Mirror_default = Mirror;
  }
});

// app/notices/ray-optics/source/sceneObjs/glass/PlaneGlass.js
var PlaneGlass_exports = {};
__export(PlaneGlass_exports, {
  default: () => PlaneGlass_default
});
var HALF_PLANE_RADIUS_IN_LENGTH_SCALES, PlaneGlass, PlaneGlass_default;
var init_PlaneGlass = __esm({
  "app/notices/ray-optics/source/sceneObjs/glass/PlaneGlass.js"() {
    "use strict";
    init_BaseGlass();
    init_LineObjMixin();
    init_i18next();
    init_geometry();
    init_BaseFilter();
    HALF_PLANE_RADIUS_IN_LENGTH_SCALES = 1e6;
    PlaneGlass = class extends LineObjMixin_default(BaseGlass_default) {
      static type = "PlaneGlass";
      static isOptical = true;
      static mergesWithGlass = true;
      static serializableDefaults = {
        p1: null,
        p2: null,
        refIndex: 1.5,
        cauchyB: 4e-3,
        partialReflect: true
      };
      static getDescription(objData, scene, detailed = false) {
        return instance.t("main:meta.parentheses", { main: instance.t("main:tools.categories.glass"), sub: instance.t("main:tools.PlaneGlass.title") });
      }
      static getPropertySchema(objData, scene) {
        return [
          ...super.getPropertySchema(objData, scene)
        ];
      }
      populateObjBar(objBar) {
        objBar.setTitle(instance.t("main:meta.parentheses", { main: instance.t("main:tools.categories.glass"), sub: instance.t("main:tools.PlaneGlass.title") }));
        super.populateObjBar(objBar);
      }
      draw(canvasRenderer, isAboveLight, isHovered) {
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
          ctx.fillStyle = "rgb(128,128,128)";
          ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
          return;
        }
        var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
        var par_x = (this.p2.x - this.p1.x) / len;
        var par_y = (this.p2.y - this.p1.y) / len;
        var per_x = par_y;
        var per_y = -par_x;
        var sufficientlyLargeDistance = (Math.abs(this.p1.x + this.scene.origin.x) + Math.abs(this.p1.y + this.scene.origin.y) + ctx.canvas.height + ctx.canvas.width) / Math.min(1, this.scene.scale);
        ctx.beginPath();
        ctx.moveTo(this.p1.x - par_x * sufficientlyLargeDistance, this.p1.y - par_y * sufficientlyLargeDistance);
        ctx.lineTo(this.p1.x + par_x * sufficientlyLargeDistance, this.p1.y + par_y * sufficientlyLargeDistance);
        ctx.lineTo(this.p1.x + (par_x - per_x) * sufficientlyLargeDistance, this.p1.y + (par_y - per_y) * sufficientlyLargeDistance);
        ctx.lineTo(this.p1.x - (par_x + per_x) * sufficientlyLargeDistance, this.p1.y - (par_y + per_y) * sufficientlyLargeDistance);
        this.fillGlass(canvasRenderer, isAboveLight, isHovered);
        if (isHovered) {
          ctx.fillStyle = "magenta";
          ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
          ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
        }
      }
      getPrimitives() {
        if (!this.p1 || !this.p2) return [];
        const dx = this.p2.x - this.p1.x;
        const dy = this.p2.y - this.p1.y;
        const length = Math.hypot(dx, dy);
        if (!(length > 0) || !Number.isFinite(length)) return [];
        const radius = HALF_PLANE_RADIUS_IN_LENGTH_SCALES * this.scene.lengthScale;
        const tx = dx / length;
        const ty = dy / length;
        const center = {
          x: (this.p1.x + this.p2.x) * 0.5,
          y: (this.p1.y + this.p2.y) * 0.5
        };
        const start = { x: center.x - tx * radius, y: center.y - ty * radius };
        const end = { x: center.x + tx * radius, y: center.y + ty * radius };
        const diameter = {
          kind: "lineSegment",
          params: { start, end }
        };
        const farArc = {
          kind: "circularArc",
          params: { start: end, end: start, bulge: 1 }
        };
        return [
          this.createGlassPrimitive([diameter, farArc]),
          {
            kind: "surface",
            curve: farArc,
            twoSided: true,
            surfaceType: BaseFilter_default.ABSORBER_SURFACE_TYPE,
            params: {}
          }
        ];
      }
      checkMouseOver(mouse) {
        let dragContext = {};
        if (mouse.isOnPoint(this.p1) && geometry_default.distanceSquared(mouse.pos, this.p1) <= geometry_default.distanceSquared(mouse.pos, this.p2)) {
          dragContext.part = 1;
          dragContext.targetPoint = geometry_default.point(this.p1.x, this.p1.y);
          return dragContext;
        }
        if (mouse.isOnPoint(this.p2)) {
          dragContext.part = 2;
          dragContext.targetPoint = geometry_default.point(this.p2.x, this.p2.y);
          return dragContext;
        }
        if (mouse.isOnLine(this)) {
          const mousePos = mouse.getPosSnappedToGrid();
          dragContext.part = 0;
          dragContext.mousePos0 = mousePos;
          dragContext.mousePos1 = mousePos;
          dragContext.snapContext = {};
          return dragContext;
        }
      }
      checkRayIntersects(ray) {
        var rp_temp = geometry_default.linesIntersection(ray, this);
        if (geometry_default.intersectionIsOnRay(rp_temp, ray)) {
          return rp_temp;
        }
      }
      onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
        var rdots = (ray.p2.x - ray.p1.x) * (this.p2.x - this.p1.x) + (ray.p2.y - ray.p1.y) * (this.p2.y - this.p1.y);
        var ssq = (this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y);
        var normal = { x: rdots * (this.p2.x - this.p1.x) - ssq * (ray.p2.x - ray.p1.x), y: rdots * (this.p2.y - this.p1.y) - ssq * (ray.p2.y - ray.p1.y) };
        var incidentType = this.getIncidentType(ray);
        if (incidentType == 1) {
          var n1 = this.getRefIndexAt(incidentPoint, ray);
        } else if (incidentType == -1) {
          var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
        } else {
          return {
            isAbsorbed: true,
            isUndefinedBehavior: true
          };
        }
        return this.refract(ray, rayIndex, incidentPoint, normal, n1, surfaceMergingObjs, ray.bodyMergingObj);
      }
      getIncidentType(ray) {
        var rcrosss = (ray.p2.x - ray.p1.x) * (this.p2.y - this.p1.y) - (ray.p2.y - ray.p1.y) * (this.p2.x - this.p1.x);
        if (rcrosss > 0) {
          return 1;
        }
        if (rcrosss < 0) {
          return -1;
        }
        return NaN;
      }
    };
    PlaneGlass_default = PlaneGlass;
  }
});

// app/notices/ray-optics/source/sceneObjs/CircleObjMixin.js
var CircleObjMixin, CircleObjMixin_default;
var init_CircleObjMixin = __esm({
  "app/notices/ray-optics/source/sceneObjs/CircleObjMixin.js"() {
    "use strict";
    init_geometry();
    init_Simulator();
    init_i18next();
    CircleObjMixin = (Base) => class extends Base {
      static getPropertySchema(objData, scene) {
        return [
          { key: "p1", type: "point", label: instance.t("simulator:sceneObjs.CircleObjMixin.center") },
          { key: "p2", type: "point", label: instance.t("simulator:sceneObjs.CircleObjMixin.radiusPoint") },
          ...super.getPropertySchema(objData, scene)
        ];
      }
      move(diffX, diffY) {
        this.p1.x = this.p1.x + diffX;
        this.p1.y = this.p1.y + diffY;
        this.p2.x = this.p2.x + diffX;
        this.p2.y = this.p2.y + diffY;
        return true;
      }
      rotate(angle, center) {
        const rotationCenter = center || this.getDefaultCenter();
        const diff_p1_x = this.p1.x - rotationCenter.x;
        const diff_p1_y = this.p1.y - rotationCenter.y;
        const diff_p2_x = this.p2.x - rotationCenter.x;
        const diff_p2_y = this.p2.y - rotationCenter.y;
        this.p1.x = rotationCenter.x + diff_p1_x * Math.cos(angle) - diff_p1_y * Math.sin(angle);
        this.p1.y = rotationCenter.y + diff_p1_x * Math.sin(angle) + diff_p1_y * Math.cos(angle);
        this.p2.x = rotationCenter.x + diff_p2_x * Math.cos(angle) - diff_p2_y * Math.sin(angle);
        this.p2.y = rotationCenter.y + diff_p2_x * Math.sin(angle) + diff_p2_y * Math.cos(angle);
        return true;
      }
      scale(scale, center) {
        const scalingCenter = center || this.getDefaultCenter();
        const diff_p1_x = this.p1.x - scalingCenter.x;
        const diff_p1_y = this.p1.y - scalingCenter.y;
        const diff_p2_x = this.p2.x - scalingCenter.x;
        const diff_p2_y = this.p2.y - scalingCenter.y;
        this.p1.x = scalingCenter.x + diff_p1_x * scale;
        this.p1.y = scalingCenter.y + diff_p1_y * scale;
        this.p2.x = scalingCenter.x + diff_p2_x * scale;
        this.p2.y = scalingCenter.y + diff_p2_y * scale;
        return true;
      }
      getDefaultCenter() {
        return this.p1;
      }
      onConstructMouseDown(mouse, ctrl, shift) {
        if (!this.constructionPoint) {
          this.constructionPoint = mouse.getPosSnappedToGrid();
          this.p1 = this.constructionPoint;
          this.p2 = this.constructionPoint;
        }
        if (shift) {
          this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
        } else {
          this.p2 = mouse.getPosSnappedToGrid();
        }
      }
      onConstructMouseMove(mouse, ctrl, shift) {
        if (shift) {
          this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
        } else {
          this.p2 = mouse.getPosSnappedToGrid();
        }
        this.p1 = this.constructionPoint;
      }
      onConstructMouseUp(mouse, ctrl, shift) {
        if (!mouse.snapsOnPoint(this.p1)) {
          delete this.constructionPoint;
          return {
            isDone: true
          };
        }
      }
      checkMouseOver(mouse) {
        let dragContext = {};
        if (mouse.isOnPoint(this.p1) && geometry_default.distanceSquared(mouse.pos, this.p1) <= geometry_default.distanceSquared(mouse.pos, this.p2)) {
          dragContext.part = 1;
          dragContext.targetPoint = geometry_default.point(this.p1.x, this.p1.y);
          return dragContext;
        }
        if (mouse.isOnPoint(this.p2)) {
          dragContext.part = 2;
          dragContext.targetPoint = geometry_default.point(this.p2.x, this.p2.y);
          return dragContext;
        }
        if (Math.abs(geometry_default.distance(this.p1, mouse.pos) - geometry_default.segmentLength(this)) < mouse.getClickExtent()) {
          const mousePos = mouse.getPosSnappedToGrid();
          dragContext.part = 0;
          dragContext.mousePos0 = mousePos;
          dragContext.mousePos1 = mousePos;
          dragContext.snapContext = {};
          return dragContext;
        }
      }
      onDrag(mouse, dragContext, ctrl, shift) {
        if (dragContext.part == 1) {
          const basePoint = dragContext.originalObj.p2;
          this.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: dragContext.originalObj.p2.x - dragContext.originalObj.p1.x, y: dragContext.originalObj.p2.y - dragContext.originalObj.p1.y }]) : mouse.getPosSnappedToGrid();
          this.p2 = basePoint;
        }
        if (dragContext.part == 2) {
          const basePoint = dragContext.originalObj.p1;
          this.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: dragContext.originalObj.p2.x - dragContext.originalObj.p1.x, y: dragContext.originalObj.p2.y - dragContext.originalObj.p1.y }]) : mouse.getPosSnappedToGrid();
          this.p1 = basePoint;
        }
        if (dragContext.part == 0) {
          if (shift) {
            var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: dragContext.originalObj.p2.x - dragContext.originalObj.p1.x, y: dragContext.originalObj.p2.y - dragContext.originalObj.p1.y }, { x: dragContext.originalObj.p2.y - dragContext.originalObj.p1.y, y: -(dragContext.originalObj.p2.x - dragContext.originalObj.p1.x) }], dragContext.snapContext);
          } else {
            var mousePos = mouse.getPosSnappedToGrid();
            dragContext.snapContext = {};
          }
          const mouseDiffX = dragContext.mousePos1.x - mousePos.x;
          const mouseDiffY = dragContext.mousePos1.y - mousePos.y;
          this.p1.x = this.p1.x - mouseDiffX;
          this.p1.y = this.p1.y - mouseDiffY;
          this.p2.x = this.p2.x - mouseDiffX;
          this.p2.y = this.p2.y - mouseDiffY;
          dragContext.mousePos1 = mousePos;
        }
      }
      /**
       * Check if a ray intersects the circle.
       * In the child class, this can be called from the `checkRayIntersects` method.
       * @param {Ray} ray - The ray.
       * @returns {Point} The intersection point, or null if there is no intersection.
       */
      checkRayIntersectsShape(ray) {
        const rp_temp = geometry_default.lineCircleIntersections(geometry_default.line(ray.p1, ray.p2), geometry_default.circle(this.p1, this.p2));
        const rp_exist = [];
        const rp_lensq = [];
        for (let i = 1; i <= 2; i++) {
          rp_exist[i] = geometry_default.intersectionIsOnRay(rp_temp[i], ray) && geometry_default.distanceSquared(rp_temp[i], ray.p1) > Simulator_default.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale;
          rp_lensq[i] = geometry_default.distanceSquared(ray.p1, rp_temp[i]);
        }
        if (rp_exist[1] && (!rp_exist[2] || rp_lensq[1] < rp_lensq[2])) {
          return rp_temp[1];
        }
        if (rp_exist[2] && (!rp_exist[1] || rp_lensq[2] < rp_lensq[1])) {
          return rp_temp[2];
        }
      }
    };
    CircleObjMixin_default = CircleObjMixin;
  }
});

// app/notices/ray-optics/source/sceneObjs/glass/CircleGlass.js
var CircleGlass_exports = {};
__export(CircleGlass_exports, {
  default: () => CircleGlass_default
});
var CircleGlass, CircleGlass_default;
var init_CircleGlass = __esm({
  "app/notices/ray-optics/source/sceneObjs/glass/CircleGlass.js"() {
    "use strict";
    init_BaseGlass();
    init_CircleObjMixin();
    init_i18next();
    init_geometry();
    CircleGlass = class extends CircleObjMixin_default(BaseGlass_default) {
      static type = "CircleGlass";
      static isOptical = true;
      static mergesWithGlass = true;
      static serializableDefaults = {
        p1: null,
        p2: null,
        refIndex: 1.5,
        cauchyB: 4e-3,
        partialReflect: true
      };
      static getDescription(objData, scene, detailed = false) {
        return instance.t("main:meta.parentheses", { main: instance.t("main:tools.categories.glass"), sub: instance.t("main:tools.CircleGlass.title") });
      }
      static getPropertySchema(objData, scene) {
        return [
          ...super.getPropertySchema(objData, scene)
        ];
      }
      populateObjBar(objBar) {
        objBar.setTitle(instance.t("main:meta.parentheses", { main: instance.t("main:tools.categories.glass"), sub: instance.t("main:tools.CircleGlass.title") }));
        super.populateObjBar(objBar);
      }
      draw(canvasRenderer, isAboveLight, isHovered) {
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        ctx.beginPath();
        ctx.arc(this.p1.x, this.p1.y, geometry_default.segmentLength(this), 0, Math.PI * 2, false);
        this.fillGlass(canvasRenderer, isAboveLight, isHovered);
        canvasRenderer.drawPoint(this.p1, this.scene.theme.centerPoint.color, this.scene.theme.centerPoint.size);
        if (isHovered) {
          ctx.fillStyle = "magenta";
          ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
        }
      }
      getPrimitives() {
        if (!this.p1 || !this.p2 || this.p1.x === this.p2.x && this.p1.y === this.p2.y) {
          return [];
        }
        return [this.createGlassPrimitive([{
          kind: "circle",
          params: {
            center: { x: this.p1.x, y: this.p1.y },
            radius: geometry_default.segmentLength(this)
          }
        }])];
      }
      checkRayIntersects(ray) {
        return this.checkRayIntersectsShape(ray);
      }
      onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
        var midpoint = geometry_default.segmentMidpoint(geometry_default.line(ray.p1, incidentPoint));
        var d = geometry_default.distanceSquared(this.p1, this.p2) - geometry_default.distanceSquared(this.p1, midpoint);
        if (d > 0) {
          var n1 = this.getRefIndexAt(incidentPoint, ray);
          var normal = { x: this.p1.x - incidentPoint.x, y: this.p1.y - incidentPoint.y };
        } else if (d < 0) {
          var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
          var normal = { x: incidentPoint.x - this.p1.x, y: incidentPoint.y - this.p1.y };
        } else {
          return {
            isAbsorbed: true,
            isUndefinedBehavior: true
          };
        }
        return this.refract(ray, rayIndex, incidentPoint, normal, n1, surfaceMergingObjs, ray.bodyMergingObj);
      }
      getIncidentType(ray) {
        var midpoint = geometry_default.segmentMidpoint(geometry_default.line(ray.p1, this.checkRayIntersects(ray)));
        var d = geometry_default.distanceSquared(this.p1, this.p2) - geometry_default.distanceSquared(this.p1, midpoint);
        if (d > 0) {
          return 1;
        }
        if (d < 0) {
          return -1;
        }
        return NaN;
      }
    };
    CircleGlass_default = CircleGlass;
  }
});

// app/notices/ray-optics/source/sceneObjs/glass/IdealLens.js
var IdealLens_exports = {};
__export(IdealLens_exports, {
  default: () => IdealLens_default
});
var IDEAL_LENS_SURFACE_TYPE, IdealLens, IdealLens_default;
var init_IdealLens = __esm({
  "app/notices/ray-optics/source/sceneObjs/glass/IdealLens.js"() {
    "use strict";
    init_BaseSceneObj();
    init_LineObjMixin();
    init_i18next();
    init_geometry();
    init_formula_parser();
    IDEAL_LENS_SURFACE_TYPE = {
      name: "Ideal lens",
      paramNames: ["center_x", "center_y", "tangent_x", "tangent_y", "f"],
      dag: parseFormula(
        `
      h = sigma * ((x - center_x) * tangent_x + (y - center_y) * tangent_y);
      slope = d_0x / (-d_0y) - h / f;
      norm = sqrt(1 + slope * slope);
      d_1x = slope / norm;
      d_1y = -1 / norm;
      P_1s = P_0s;
      P_1p = P_0p;
    `,
        [
          "d_0x",
          "d_0y",
          "P_0s",
          "P_0p",
          "x",
          "y",
          "sigma",
          "center_x",
          "center_y",
          "tangent_x",
          "tangent_y",
          "f"
        ]
      ),
      outRayCount: 1,
      mergesWithBoundary: false
    };
    IdealLens = class extends LineObjMixin_default(BaseSceneObj_default) {
      static type = "IdealLens";
      static isOptical = true;
      static serializableDefaults = {
        p1: null,
        p2: null,
        focalLength: 100
      };
      static getDescription(objData, scene, detailed = false) {
        return instance.t("main:tools.IdealLens.title");
      }
      static getPropertySchema(objData, scene) {
        return [
          ...super.getPropertySchema(objData, scene),
          { key: "focalLength", type: "number", label: instance.t("simulator:sceneObjs.common.focalLength") }
        ];
      }
      populateObjBar(objBar) {
        objBar.setTitle(instance.t("main:tools.IdealLens.title"));
        objBar.createNumber(instance.t("simulator:sceneObjs.common.focalLength"), -1e3 * this.scene.lengthScale, 1e3 * this.scene.lengthScale, 1 * this.scene.lengthScale, this.focalLength, function(obj, value) {
          obj.focalLength = value;
        }, instance.t("simulator:sceneObjs.common.lengthUnitInfo"));
      }
      draw(canvasRenderer, isAboveLight, isHovered) {
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
          ctx.fillStyle = "rgb(128,128,128)";
          ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
          return;
        }
        var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
        var par_x = (this.p2.x - this.p1.x) / len;
        var par_y = (this.p2.y - this.p1.y) / len;
        var per_x = par_y;
        var per_y = -par_x;
        var arrow_size_per = this.scene.theme.idealCurveArrow.size / 2 * ls;
        var arrow_size_par = this.scene.theme.idealCurveArrow.size / 2 * ls;
        var center_size = this.scene.theme.idealCurveArrow.size / 5 * ls;
        ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor([(this.scene.theme.glass.color.r + this.scene.theme.background.color.r) / 2, (this.scene.theme.glass.color.g + this.scene.theme.background.color.g) / 2, (this.scene.theme.glass.color.b + this.scene.theme.background.color.b) / 2, 1]);
        ctx.globalAlpha = 1 / (Math.abs(this.focalLength / this.scene.lengthScale) / 100 + 1);
        ctx.lineWidth = this.scene.theme.idealCurveArrow.size / 5 * 2 * ls;
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
        ctx.lineWidth = 1 * ls;
        ctx.globalAlpha = 1;
        ctx.fillStyle = canvasRenderer.rgbaToCssColor(this.scene.theme.idealCurveArrow.color);
        var center = geometry_default.segmentMidpoint(this);
        ctx.strokeStyle = canvasRenderer.rgbaToCssColor(this.scene.theme.idealCurveCenter.color);
        ctx.beginPath();
        ctx.moveTo(center.x - per_x * center_size, center.y - per_y * center_size);
        ctx.lineTo(center.x + per_x * center_size, center.y + per_y * center_size);
        ctx.stroke();
        if (this.focalLength > 0) {
          ctx.beginPath();
          ctx.moveTo(this.p1.x - par_x * arrow_size_par, this.p1.y - par_y * arrow_size_par);
          ctx.lineTo(this.p1.x + par_x * arrow_size_par + per_x * arrow_size_per, this.p1.y + par_y * arrow_size_par + per_y * arrow_size_per);
          ctx.lineTo(this.p1.x + par_x * arrow_size_par - per_x * arrow_size_per, this.p1.y + par_y * arrow_size_par - per_y * arrow_size_per);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(this.p2.x + par_x * arrow_size_par, this.p2.y + par_y * arrow_size_par);
          ctx.lineTo(this.p2.x - par_x * arrow_size_par + per_x * arrow_size_per, this.p2.y - par_y * arrow_size_par + per_y * arrow_size_per);
          ctx.lineTo(this.p2.x - par_x * arrow_size_par - per_x * arrow_size_per, this.p2.y - par_y * arrow_size_par - per_y * arrow_size_per);
          ctx.fill();
        }
        if (this.focalLength < 0) {
          ctx.beginPath();
          ctx.moveTo(this.p1.x + par_x * arrow_size_par, this.p1.y + par_y * arrow_size_par);
          ctx.lineTo(this.p1.x - par_x * arrow_size_par + per_x * arrow_size_per, this.p1.y - par_y * arrow_size_par + per_y * arrow_size_per);
          ctx.lineTo(this.p1.x - par_x * arrow_size_par - per_x * arrow_size_per, this.p1.y - par_y * arrow_size_par - per_y * arrow_size_per);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(this.p2.x - par_x * arrow_size_par, this.p2.y - par_y * arrow_size_par);
          ctx.lineTo(this.p2.x + par_x * arrow_size_par + per_x * arrow_size_per, this.p2.y + par_y * arrow_size_par + per_y * arrow_size_per);
          ctx.lineTo(this.p2.x + par_x * arrow_size_par - per_x * arrow_size_per, this.p2.y + par_y * arrow_size_par - per_y * arrow_size_per);
          ctx.fill();
        }
        if (isHovered) {
          var mp = geometry_default.segmentMidpoint(this);
          ctx.fillStyle = "rgb(255,0,255)";
          ctx.fillRect(mp.x + this.focalLength * per_x - 1.5 * ls, mp.y + this.focalLength * per_y - 1.5 * ls, 3 * ls, 3 * ls);
          ctx.fillRect(mp.x - this.focalLength * per_x - 1.5 * ls, mp.y - this.focalLength * per_y - 1.5 * ls, 3 * ls, 3 * ls);
        }
      }
      scale(scale, center) {
        super.scale(scale, center);
        this.focalLength *= scale;
        return true;
      }
      getPrimitives() {
        if (!this.p1 || !this.p2) return [];
        const dx = this.p2.x - this.p1.x;
        const dy = this.p2.y - this.p1.y;
        const length = Math.hypot(dx, dy);
        if (!(length > 0) || !Number.isFinite(length)) return [];
        return [{
          kind: "surface",
          curve: {
            kind: "lineSegment",
            params: {
              start: { x: this.p1.x, y: this.p1.y },
              end: { x: this.p2.x, y: this.p2.y }
            }
          },
          twoSided: true,
          surfaceType: IDEAL_LENS_SURFACE_TYPE,
          params: {
            center_x: (this.p1.x + this.p2.x) * 0.5,
            center_y: (this.p1.y + this.p2.y) * 0.5,
            tangent_x: dx / length,
            tangent_y: dy / length,
            f: this.focalLength
          }
        }];
      }
      checkRayIntersects(ray) {
        return this.checkRayIntersectsShape(ray);
      }
      onRayIncident(ray, rayIndex, incidentPoint) {
        var lens_length = geometry_default.segmentLength(this);
        var main_line_unitvector_x = (-this.p1.y + this.p2.y) / lens_length;
        var main_line_unitvector_y = (this.p1.x - this.p2.x) / lens_length;
        var mid_point = geometry_default.segmentMidpoint(this);
        var twoF_point_1 = geometry_default.point(mid_point.x + main_line_unitvector_x * 2 * this.focalLength, mid_point.y + main_line_unitvector_y * 2 * this.focalLength);
        var twoF_point_2 = geometry_default.point(mid_point.x - main_line_unitvector_x * 2 * this.focalLength, mid_point.y - main_line_unitvector_y * 2 * this.focalLength);
        var twoF_line_near, twoF_line_far;
        if (geometry_default.distanceSquared(ray.p1, twoF_point_1) < geometry_default.distanceSquared(ray.p1, twoF_point_2)) {
          twoF_line_near = geometry_default.parallelLineThroughPoint(this, twoF_point_1);
          twoF_line_far = geometry_default.parallelLineThroughPoint(this, twoF_point_2);
        } else {
          twoF_line_near = geometry_default.parallelLineThroughPoint(this, twoF_point_2);
          twoF_line_far = geometry_default.parallelLineThroughPoint(this, twoF_point_1);
        }
        if (this.focalLength > 0) {
          ray.p2 = geometry_default.linesIntersection(twoF_line_far, geometry_default.line(mid_point, geometry_default.linesIntersection(twoF_line_near, ray)));
          ray.p1 = incidentPoint;
        } else {
          ray.p2 = geometry_default.linesIntersection(twoF_line_far, geometry_default.line(incidentPoint, geometry_default.linesIntersection(twoF_line_near, geometry_default.line(mid_point, geometry_default.linesIntersection(twoF_line_far, ray)))));
          ray.p1 = incidentPoint;
        }
      }
    };
    IdealLens_default = IdealLens;
  }
});

// app/notices/ray-optics/source/sceneObjs/blocker/Blocker.js
var Blocker_exports = {};
__export(Blocker_exports, {
  default: () => Blocker_default
});
var Blocker, Blocker_default;
var init_Blocker = __esm({
  "app/notices/ray-optics/source/sceneObjs/blocker/Blocker.js"() {
    "use strict";
    init_BaseFilter();
    init_LineObjMixin();
    init_i18next();
    init_Simulator();
    Blocker = class extends LineObjMixin_default(BaseFilter_default) {
      static type = "Blocker";
      static isOptical = true;
      static mergesWithGlass = true;
      static serializableDefaults = {
        p1: null,
        p2: null,
        filter: false,
        invert: false,
        wavelength: Simulator_default.GREEN_WAVELENGTH,
        bandwidth: 10
      };
      static getDescription(objData, scene, detailed = false) {
        return instance.t("main:tools.Blocker.title");
      }
      static getPropertySchema(objData, scene) {
        return [
          ...super.getPropertySchema(objData, scene)
        ];
      }
      populateObjBar(objBar) {
        objBar.setTitle(instance.t("main:tools.Blocker.title"));
        super.populateObjBar(objBar);
      }
      draw(canvasRenderer, isAboveLight, isHovered) {
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
          ctx.fillStyle = "rgb(128,128,128)";
          ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
          return;
        }
        const colorArray = this.scene.simulator.wavelengthToColor(this.wavelength || Simulator_default.GREEN_WAVELENGTH, 1);
        ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.simulateColors && this.wavelength && this.filter ? colorArray : this.scene.theme.blocker.color);
        ctx.lineWidth = this.scene.theme.blocker.width * ls;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
        ctx.lineWidth = 1 * ls;
      }
      getPrimitives() {
        if (!this.p1 || !this.p2 || this.p1.x === this.p2.x && this.p1.y === this.p2.y) {
          return [];
        }
        return [this.createAbsorberPrimitive({
          kind: "lineSegment",
          params: {
            start: { x: this.p1.x, y: this.p1.y },
            end: { x: this.p2.x, y: this.p2.y }
          }
        })];
      }
      checkRayIntersects(ray) {
        if (this.checkRayIntersectFilter(ray)) {
          return this.checkRayIntersectsShape(ray);
        } else {
          return null;
        }
      }
      onRayIncident(ray, rayIndex, incidentPoint) {
        return {
          isAbsorbed: true
        };
      }
    };
    Blocker_default = Blocker;
  }
});

// app/notices/ray-optics/source/sceneObjs/other/Ruler.js
var Ruler_exports = {};
__export(Ruler_exports, {
  default: () => Ruler_default
});
var Ruler, Ruler_default;
var init_Ruler = __esm({
  "app/notices/ray-optics/source/sceneObjs/other/Ruler.js"() {
    "use strict";
    init_BaseSceneObj();
    init_LineObjMixin();
    init_i18next();
    Ruler = class extends LineObjMixin_default(BaseSceneObj_default) {
      static type = "Ruler";
      static serializableDefaults = {
        p1: null,
        p2: null,
        scaleInterval: 10
      };
      static getDescription(objData, scene, detailed = false) {
        return instance.t("main:tools.Ruler.title");
      }
      static getPropertySchema(objData, scene) {
        return [
          { key: "p1", type: "point", label: instance.t("simulator:sceneObjs.Ruler.zeroPoint") },
          { key: "p2", type: "point", label: instance.t("simulator:sceneObjs.LineObjMixin.endpoint2") },
          { key: "scaleInterval", type: "number", label: instance.t("simulator:sceneObjs.Ruler.scaleInterval") }
        ];
      }
      populateObjBar(objBar) {
        objBar.setTitle(instance.t("main:tools.Ruler.title"));
        objBar.createNumber(instance.t("simulator:sceneObjs.Ruler.scaleInterval"), 0, 10, 1, this.scaleInterval, function(obj, value) {
          obj.scaleInterval = value;
        }, instance.t("simulator:sceneObjs.common.lengthUnitInfo"), true);
      }
      draw(canvasRenderer, isAboveLight, isHovered) {
        if (isAboveLight) return;
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
          ctx.fillStyle = "rgb(128,128,128)";
          ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
          return;
        }
        if (this.scene.theme.background.color.r == 0 && this.scene.theme.background.color.g == 0 && this.scene.theme.background.color.b == 0) {
          ctx.globalCompositeOperation = "lighter";
        } else {
          ctx.globalCompositeOperation = "source-over";
        }
        var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
        var par_x = (this.p2.x - this.p1.x) / len;
        var par_y = (this.p2.y - this.p1.y) / len;
        var per_x = par_y;
        var per_y = -par_x;
        var ang = Math.atan2(this.p2.y - this.p1.y, this.p2.x - this.p1.x);
        var scale_step = this.scaleInterval;
        var scale_step_mid = scale_step * 5;
        var scale_step_long = scale_step * 10;
        var scale_len = 10 * ls;
        var scale_len_mid = 15 * ls;
        ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.ruler.color);
        ctx.font = this.scene.theme.rulerText.size * ls + "px " + this.scene.theme.rulerText.font;
        ctx.fillStyle = canvasRenderer.rgbaToCssColor(this.scene.theme.rulerText.color);
        if (ang > Math.PI * -0.25 && ang <= Math.PI * 0.25) {
          var scale_direction = -1;
          var scale_len_long = 20 * ls;
          var text_ang = ang;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
        } else if (ang > Math.PI * -0.75 && ang <= Math.PI * -0.25) {
          var scale_direction = 1;
          var scale_len_long = 15 * ls;
          var text_ang = ang - Math.PI * -0.5;
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
        } else if (ang > Math.PI * 0.75 || ang <= Math.PI * -0.75) {
          var scale_direction = 1;
          var scale_len_long = 20 * ls;
          var text_ang = ang - Math.PI;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
        } else {
          var scale_direction = -1;
          var scale_len_long = 15 * ls;
          var text_ang = ang - Math.PI * 0.5;
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
        }
        ctx.lineWidth = this.scene.theme.ruler.width * ls;
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        var x, y;
        for (var i = 0; i <= len; i += scale_step) {
          ctx.moveTo(this.p1.x + i * par_x, this.p1.y + i * par_y);
          if (i % scale_step_long == 0) {
            x = this.p1.x + i * par_x + scale_direction * scale_len_long * per_x;
            y = this.p1.y + i * par_y + scale_direction * scale_len_long * per_y;
            ctx.lineTo(x, y);
            if (canvasRenderer.isSVG) ctx.stroke();
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(text_ang);
            ctx.fillText(i, 0, 0);
            ctx.restore();
          } else if (i % scale_step_mid == 0) {
            ctx.lineTo(this.p1.x + i * par_x + scale_direction * scale_len_mid * per_x, this.p1.y + i * par_y + scale_direction * scale_len_mid * per_y);
          } else {
            ctx.lineTo(this.p1.x + i * par_x + scale_direction * scale_len * per_x, this.p1.y + i * par_y + scale_direction * scale_len * per_y);
          }
        }
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
      scale(scale, center) {
        super.scale(scale, center);
        return false;
      }
      getDefaultCenter() {
        return this.p1;
      }
    };
    Ruler_default = Ruler;
  }
});

// app/notices/ray-optics/source/sceneObjs/other/Detector.js
var Detector_exports = {};
__export(Detector_exports, {
  default: () => Detector_default
});
var DETECTOR_TYPE, IRRADIANCE_MAP_DETECTOR_TYPE, Detector2, Detector_default;
var init_Detector = __esm({
  "app/notices/ray-optics/source/sceneObjs/other/Detector.js"() {
    "use strict";
    init_BaseSceneObj();
    init_LineObjMixin();
    init_i18next();
    init_geometry();
    init_formula_parser();
    DETECTOR_TYPE = {
      name: "Detector",
      paramNames: [],
      dag: parseFormula(
        `
      P = P_0s + P_0p;
      k_1 = 0;
      v_1 = sigma * P;
      k_2 = 1;
      v_2 = -d_0y * P;
      k_3 = 2;
      v_3 = -d_0x * P;
    `,
        ["d_0x", "d_0y", "P_0s", "P_0p", "sigma"]
      ),
      writeCount: 3
    };
    IRRADIANCE_MAP_DETECTOR_TYPE = {
      name: "Detector with irradiance map",
      paramNames: ["L", "h"],
      dag: parseFormula(
        `
      P = P_0s + P_0p;
      k_1 = 0;
      v_1 = sigma * P;
      k_2 = 1;
      v_2 = -d_0y * P;
      k_3 = 2;
      v_3 = -d_0x * P;
      k_4 = 3 + floor(u * L / h);
      v_4 = sigma * P;
    `,
        ["d_0x", "d_0y", "P_0s", "P_0p", "sigma", "u", "L", "h"]
      ),
      writeCount: 4
    };
    Detector2 = class extends LineObjMixin_default(BaseSceneObj_default) {
      static type = "Detector";
      static isOptical = true;
      static serializableDefaults = {
        p1: null,
        p2: null,
        twoSided: true,
        irradMap: false,
        binSize: 1
      };
      constructor(scene, properties) {
        super(scene, properties);
        this.power = 0;
        this.normal = 0;
        this.shear = 0;
        this.binData = null;
        this.results = { values: null };
      }
      static getDescription(objData, scene, detailed = false) {
        return instance.t("main:tools.Detector.title");
      }
      static getPropertySchema(objData, scene) {
        return [
          ...super.getPropertySchema(objData, scene),
          { key: "twoSided", type: "boolean", label: instance.t("simulator:sceneObjs.Detector.twoSided") },
          { key: "irradMap", type: "boolean", label: instance.t("simulator:sceneObjs.Detector.irradMap") },
          { key: "binSize", type: "number", label: instance.t("simulator:sceneObjs.Detector.binSize") }
        ];
      }
      populateObjBar(objBar) {
        if (this.scene.colorMode !== "default") {
          var sInfo = instance.t("simulator:sceneObjs.Detector.info.sNewColorModes");
        } else {
          var sInfo = instance.t("simulator:sceneObjs.Detector.info.s");
        }
        objBar.setTitle(instance.t("main:tools.Detector.title"));
        objBar.createInfoBox("<ul><li>" + instance.t("simulator:sceneObjs.Detector.info.P") + "</li><li>" + instance.t("simulator:sceneObjs.Detector.info.Fperp") + "</li><li>" + instance.t("simulator:sceneObjs.Detector.info.Fpar") + "</li><li>" + instance.t("simulator:sceneObjs.Detector.info.irradiance") + "</li><li>" + instance.t("simulator:sceneObjs.Detector.info.length") + "</li><li>" + instance.t("simulator:sceneObjs.Detector.info.B") + "</li><li>" + sInfo + "</li><li>" + instance.t("simulator:sceneObjs.Detector.info.truncation") + "</li></ul>");
        objBar.createBoolean(instance.t("simulator:sceneObjs.Detector.twoSided"), this.twoSided, function(obj, value) {
          obj.twoSided = value;
        });
        objBar.createBoolean(instance.t("simulator:sceneObjs.Detector.irradMap"), this.irradMap, function(obj, value) {
          obj.irradMap = value;
        }, null, true);
        if (this.irradMap) {
          objBar.createNumber(instance.t("simulator:sceneObjs.Detector.binSize"), 0.01 * this.scene.lengthScale, 10 * this.scene.lengthScale, 0.01 * this.scene.lengthScale, this.binSize, function(obj, value) {
            obj.binSize = value;
          }, instance.t("simulator:sceneObjs.common.lengthUnitInfo"));
          const self2 = this;
          objBar.createButton(instance.t("simulator:sceneObjs.Detector.exportData"), function(obj) {
            var binSize = obj.binSize;
            var binNum = Math.ceil(Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y)) / binSize);
            var binData = obj.binData;
            var csv = "data:text/csv;charset=utf-8,";
            csv += "Position,Irradiance\n";
            for (var i = 0; i < binNum; i++) {
              csv += i * binSize + "," + binData[i] / binSize + "\n";
            }
            var encodedUri = encodeURI(csv);
            var link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", (self2.scene.name || "irradiance_map") + ".csv");
            document.body.appendChild(link);
            link.click();
          });
        }
      }
      draw(canvasRenderer, isAboveLight, isHovered) {
        this.updateMeasurementsFromPrimitiveResults();
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        if (!isAboveLight) {
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.detector.color);
          ctx.lineWidth = this.scene.theme.detector.width * ls;
          ctx.setLineDash(this.scene.theme.detector.dash.map((d) => d * ls));
          ctx.beginPath();
          ctx.moveTo(this.p1.x, this.p1.y);
          ctx.lineTo(this.p2.x, this.p2.y);
          ctx.stroke();
          if (!this.twoSided) {
            const dx = this.p2.x - this.p1.x;
            const dy = this.p2.y - this.p1.y;
            const len2 = Math.sqrt(dx * dx + dy * dy);
            if (len2 > 0) {
              const perpX = -dy / len2;
              const perpY = dx / len2;
              const shiftDistance = this.scene.theme.detector.width * ls;
              const dotLength = Math.max(this.scene.theme.detector.width * ls, 1);
              const dotGap = Math.max(this.scene.theme.detector.width * 2 * ls, 2);
              ctx.setLineDash([dotLength, dotGap]);
              ctx.beginPath();
              ctx.moveTo(this.p1.x - perpX * shiftDistance, this.p1.y - perpY * shiftDistance);
              ctx.lineTo(this.p2.x - perpX * shiftDistance, this.p2.y - perpY * shiftDistance);
              ctx.stroke();
            }
          }
          ctx.setLineDash([]);
          ctx.globalCompositeOperation = "source-over";
        } else {
          if (!this.scene.simulator?.isLightLayerSynced) {
            ctx.globalAlpha = 0.5;
          }
          ctx.globalCompositeOperation = "lighter";
          var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
          var accuracy = Math.max(-Math.floor(Math.log10(this.scene.simulator.totalTruncation)), 0);
          if (this.scene.simulator.totalTruncation > 0 && accuracy <= 2) {
            var str1 = "P=" + this.power.toFixed(accuracy) + "\xB1" + this.scene.simulator.totalTruncation.toFixed(accuracy);
            var str2 = "F\u22A5=" + this.normal.toFixed(accuracy) + "\xB1" + this.scene.simulator.totalTruncation.toFixed(accuracy);
            var str3 = "F\u2225=" + this.shear.toFixed(accuracy) + "\xB1" + this.scene.simulator.totalTruncation.toFixed(accuracy);
          } else {
            var str1 = "P=" + this.power.toFixed(2);
            var str2 = "F\u22A5=" + this.normal.toFixed(2);
            var str3 = "F\u2225=" + this.shear.toFixed(2);
          }
          ctx.font = this.scene.theme.detectorText.size * ls + "px " + this.scene.theme.detectorText.font;
          ctx.textAlign = "right";
          ctx.textBaseline = "top";
          ctx.fillStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.detectorText.color);
          ctx.fillText(str1, this.p2.x, this.p2.y);
          ctx.fillText(str2, this.p2.x, this.p2.y + 20 * ls);
          ctx.fillText(str3, this.p2.x, this.p2.y + 40 * ls);
          ctx.globalCompositeOperation = "source-over";
          if (this.irradMap && this.binData) {
            var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
            var ux = (this.p2.x - this.p1.x) / len;
            var uy = (this.p2.y - this.p1.y) / len;
            var vx = uy;
            var vy = -ux;
            ctx.lineWidth = this.scene.theme.irradMapBorder.width * ls;
            ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.irradMapBorder.color);
            ctx.fillStyle = canvasRenderer.rgbaToCssColor(this.scene.theme.irradMap.color);
            ctx.beginPath();
            ctx.moveTo(this.p1.x, this.p1.y);
            for (var i = 0; i < this.binData.length; i++) {
              ctx.lineTo(this.p1.x + ux * i * this.binSize + vx * this.binData[i] / this.binSize * 20 * ls * ls, this.p1.y + uy * i * this.binSize + vy * this.binData[i] / this.binSize * 20 * ls * ls);
              ctx.lineTo(this.p1.x + ux * (i + 1) * this.binSize + vx * this.binData[i] / this.binSize * 20 * ls * ls, this.p1.y + uy * (i + 1) * this.binSize + vy * this.binData[i] / this.binSize * 20 * ls * ls);
            }
            ctx.lineTo(this.p2.x, this.p2.y);
            ctx.fill();
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
      scale(scale, center) {
        super.scale(scale, center);
        return false;
      }
      getPrimitives() {
        if (!this.p1 || !this.p2 || this.p1.x === this.p2.x && this.p1.y === this.p2.y) {
          return [];
        }
        const length = geometry_default.segmentLength(this);
        const binCount = this.irradMap ? Math.ceil(length / this.binSize) : 0;
        return [{
          kind: "detector",
          curve: {
            kind: "lineSegment",
            params: {
              start: { x: this.p1.x, y: this.p1.y },
              end: { x: this.p2.x, y: this.p2.y }
            }
          },
          twoSided: this.twoSided,
          detectorType: this.irradMap ? IRRADIANCE_MAP_DETECTOR_TYPE : DETECTOR_TYPE,
          params: this.irradMap ? { L: length, h: this.binSize } : {},
          resultSize: 3 + binCount,
          result: this.results
        }];
      }
      onSimulationStart() {
        this.results.values = null;
        this.power = 0;
        this.normal = 0;
        this.shear = 0;
        if (this.irradMap) {
          var binSize = this.binSize;
          var binNum = Math.ceil(Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y)) / binSize);
          var binData = [];
          for (var i = 0; i < binNum; i++) {
            binData[i] = 0;
          }
          this.binData = binData;
        }
      }
      checkRayIntersects(ray) {
        if (!this.twoSided && this.getIncidentType(ray) != 1) {
          return null;
        }
        return this.checkRayIntersectsShape(ray);
      }
      onRayIncident(ray, rayIndex, incidentPoint) {
        var rcrosss = (ray.p2.x - ray.p1.x) * (this.p2.y - this.p1.y) - (ray.p2.y - ray.p1.y) * (this.p2.x - this.p1.x);
        var sint = rcrosss / Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y)) / Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
        var cost = ((ray.p2.x - ray.p1.x) * (this.p2.x - this.p1.x) + (ray.p2.y - ray.p1.y) * (this.p2.y - this.p1.y)) / Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y)) / Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
        ray.p2 = geometry_default.point(incidentPoint.x + ray.p2.x - ray.p1.x, incidentPoint.y + ray.p2.y - ray.p1.y);
        ray.p1 = geometry_default.point(incidentPoint.x, incidentPoint.y);
        this.power += Math.sign(rcrosss) * (ray.brightness_s + ray.brightness_p);
        this.normal += Math.sign(rcrosss) * sint * (ray.brightness_s + ray.brightness_p);
        this.shear -= Math.sign(rcrosss) * cost * (ray.brightness_s + ray.brightness_p);
        if (this.irradMap && this.binData) {
          var binSize = this.binSize;
          var binNum = Math.ceil(Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y)) / binSize);
          var binIndex = Math.floor(Math.sqrt((incidentPoint.x - this.p1.x) * (incidentPoint.x - this.p1.x) + (incidentPoint.y - this.p1.y) * (incidentPoint.y - this.p1.y)) / binSize);
          this.binData[binIndex] += Math.sign(rcrosss) * (ray.brightness_s + ray.brightness_p);
        }
      }
      getIncidentType(ray) {
        var rcrosss = (ray.p2.x - ray.p1.x) * (this.p2.y - this.p1.y) - (ray.p2.y - ray.p1.y) * (this.p2.x - this.p1.x);
        if (rcrosss > 0) {
          return 1;
        }
        if (rcrosss < 0) {
          return -1;
        }
        return NaN;
      }
      updateMeasurementsFromPrimitiveResults() {
        const values = this.results.values;
        if (!values) {
          return;
        }
        this.power = values[0] ?? 0;
        this.normal = values[1] ?? 0;
        this.shear = values[2] ?? 0;
        this.binData = this.irradMap ? Array.from(values).slice(3) : null;
      }
    };
    Detector_default = Detector2;
  }
});

// app/node_modules/.pnpm/escape-html@1.0.3/node_modules/escape-html/index.js
var require_escape_html = __commonJS({
  "app/node_modules/.pnpm/escape-html@1.0.3/node_modules/escape-html/index.js"(exports, module) {
    "use strict";
    var matchHtmlRegExp = /["'&<>]/;
    module.exports = escapeHtml2;
    function escapeHtml2(string) {
      var str = "" + string;
      var match = matchHtmlRegExp.exec(str);
      if (!match) {
        return str;
      }
      var escape2;
      var html = "";
      var index = 0;
      var lastIndex = 0;
      for (index = match.index; index < str.length; index++) {
        switch (str.charCodeAt(index)) {
          case 34:
            escape2 = "&quot;";
            break;
          case 38:
            escape2 = "&amp;";
            break;
          case 39:
            escape2 = "&#39;";
            break;
          case 60:
            escape2 = "&lt;";
            break;
          case 62:
            escape2 = "&gt;";
            break;
          default:
            continue;
        }
        if (lastIndex !== index) {
          html += str.substring(lastIndex, index);
        }
        lastIndex = index + 1;
        html += escape2;
      }
      return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
    }
  }
});

// app/notices/ray-optics/source/sceneObjs/other/TextLabel.js
var TextLabel_exports = {};
__export(TextLabel_exports, {
  default: () => TextLabel_default
});
var import_escape_html, TextLabel, TextLabel_default;
var init_TextLabel = __esm({
  "app/notices/ray-optics/source/sceneObjs/other/TextLabel.js"() {
    "use strict";
    init_BaseSceneObj();
    init_i18next();
    init_geometry();
    import_escape_html = __toESM(require_escape_html(), 1);
    TextLabel = class extends BaseSceneObj_default {
      static type = "TextLabel";
      static serializableDefaults = {
        x: null,
        y: null,
        text: "",
        fontSize: 24,
        font: "Serif",
        fontStyle: "Normal",
        alignment: "left",
        smallCaps: false,
        angle: 0,
        fillStyle: null
      };
      static getDescription(objData, scene, detailed = false) {
        const baseTitle = instance.t("main:tools.TextLabel.title");
        if (!detailed) return baseTitle;
        const text = objData?.text ?? "";
        return text ? instance.t("main:meta.colon", { name: baseTitle, value: (0, import_escape_html.default)(text) }) : baseTitle;
      }
      static getPropertySchema(objData, scene) {
        return [
          { key: "", type: "point", label: instance.t("simulator:sceneObjs.common.coordOrigin") },
          { key: "text", type: "text", label: instance.t("simulator:sceneObjs.TextLabel.text"), info: instance.t("simulator:sceneObjs.TextLabel.moduleInfo") },
          { key: "fontSize", type: "number", label: instance.t("simulator:sceneObjs.TextLabel.fontSize") },
          { key: "font", type: "text", label: instance.t("simulator:sceneObjs.TextLabel.font") },
          { key: "fontStyle", type: "dropdown", label: instance.t("simulator:sceneObjs.TextLabel.fontStyle"), options: {
            "Normal": instance.t("simulator:sceneObjs.TextLabel.fontStyles.normal"),
            "Bold": instance.t("simulator:sceneObjs.TextLabel.fontStyles.bold"),
            "Italic": instance.t("simulator:sceneObjs.TextLabel.fontStyles.italic"),
            "Bold Italic": instance.t("simulator:sceneObjs.TextLabel.fontStyles.boldItalic"),
            "Oblique": instance.t("simulator:sceneObjs.TextLabel.fontStyles.oblique"),
            "Bold Oblique": instance.t("simulator:sceneObjs.TextLabel.fontStyles.boldOblique")
          } },
          { key: "alignment", type: "dropdown", label: instance.t("simulator:sceneObjs.TextLabel.alignment"), options: {
            "left": instance.t("simulator:sceneObjs.TextLabel.alignments.left"),
            "center": instance.t("simulator:sceneObjs.TextLabel.alignments.center"),
            "right": instance.t("simulator:sceneObjs.TextLabel.alignments.right")
          } },
          { key: "smallCaps", type: "boolean", label: instance.t("simulator:sceneObjs.TextLabel.smallCaps") },
          { key: "angle", type: "number", label: instance.t("simulator:sceneObjs.TextLabel.angle") + " (\xB0)" },
          { key: "fillStyle", type: "style", styleKind: "fill", label: instance.t("simulator:sceneObjs.common.fillStyle") }
        ];
      }
      populateObjBar(objBar) {
        objBar.setTitle(instance.t("main:tools.TextLabel.title"));
        objBar.createText("", this.text, function(obj, value) {
          obj.text = value;
        });
        if (objBar.showAdvanced(!this.arePropertiesDefault(["fontSize"]))) {
          objBar.createNumber(instance.t("simulator:sceneObjs.TextLabel.fontSize"), 6, 96, 1, this.fontSize, function(obj, value) {
            obj.fontSize = value;
          }, null, true);
        }
        if (objBar.showAdvanced(!this.arePropertiesDefault(["font"]))) {
          const fontLines = instance.t("simulator:sceneObjs.TextLabel.fonts").split("\n");
          const fonts = {};
          for (const line of fontLines) {
            const [key, value] = line.split(": ");
            fonts[key] = value;
          }
          fonts["custom"] = instance.t("simulator:sceneObjs.TextLabel.enterFontName");
          objBar.createDropdown(instance.t("simulator:sceneObjs.TextLabel.font"), fonts[this.font] ? this.font : "custom", fonts, function(obj, value) {
            if (value != "custom") {
              obj.font = value;
            } else {
              obj.font = "";
            }
          }, instance.t("simulator:sceneObjs.TextLabel.fontNote"), true);
          if (!fonts[this.font]) {
            objBar.createText("", this.font, function(obj, value) {
              obj.font = value;
            });
          }
        }
        if (objBar.showAdvanced(!this.arePropertiesDefault(["fontStyle"]))) {
          objBar.createDropdown(instance.t("simulator:sceneObjs.TextLabel.fontStyle"), this.fontStyle, {
            "Normal": instance.t("simulator:sceneObjs.TextLabel.fontStyles.normal"),
            "Bold": instance.t("simulator:sceneObjs.TextLabel.fontStyles.bold"),
            "Italic": instance.t("simulator:sceneObjs.TextLabel.fontStyles.italic"),
            "Bold Italic": instance.t("simulator:sceneObjs.TextLabel.fontStyles.boldItalic"),
            "Oblique": instance.t("simulator:sceneObjs.TextLabel.fontStyles.oblique"),
            "Bold Oblique": instance.t("simulator:sceneObjs.TextLabel.fontStyles.boldOblique")
          }, function(obj, value) {
            obj.fontStyle = value;
          });
        }
        if (objBar.showAdvanced(!this.arePropertiesDefault(["alignment"]))) {
          objBar.createDropdown(instance.t("simulator:sceneObjs.TextLabel.alignment"), this.alignment, {
            "left": instance.t("simulator:sceneObjs.TextLabel.alignments.left"),
            "center": instance.t("simulator:sceneObjs.TextLabel.alignments.center"),
            "right": instance.t("simulator:sceneObjs.TextLabel.alignments.right")
          }, function(obj, value) {
            obj.alignment = value;
          });
        }
        if (objBar.showAdvanced(!this.arePropertiesDefault(["smallCaps"]))) {
          objBar.createBoolean(instance.t("simulator:sceneObjs.TextLabel.smallCaps"), this.smallCaps, function(obj, value) {
            obj.smallCaps = value;
          });
        }
        if (objBar.showAdvanced(!this.arePropertiesDefault(["angle"]))) {
          objBar.createNumber(instance.t("simulator:sceneObjs.TextLabel.angle") + " (\xB0)", 0, 360, 1, this.angle, function(obj, value) {
            obj.angle = value;
          }, null, true);
        }
        if (objBar.showAdvanced(!this.arePropertiesDefault(["fillStyle"]))) {
          objBar.createFillStyleControl(
            instance.t("simulator:sceneObjs.common.fillStyle"),
            this.fillStyle,
            this.scene.theme.decoration,
            function(value) {
              objBar.setOption(function(obj) {
                obj.fillStyle = JSON.parse(JSON.stringify(value));
              });
            },
            function(obj) {
              obj.fillStyle = null;
            }
          );
        }
      }
      draw(canvasRenderer, isAboveLight, isHovered) {
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        const style = this.fillStyle || this.scene.theme.decoration;
        const fillColor = style.color || this.scene.theme.decoration.color;
        ctx.fillStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(fillColor);
        ctx.textAlign = this.alignment;
        ctx.textBaseline = "bottom";
        let font = "";
        if (this.fontStyle && this.fontStyle != "Normal") font += this.fontStyle + " ";
        if (this.smallCaps) font += "small-caps ";
        font += this.fontSize + "px " + this.font;
        ctx.font = font;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(-this.angle / 180 * Math.PI);
        let y_offset = 0;
        this.left = 0;
        this.right = 0;
        this.up = 0;
        this.down = 0;
        this.text.toString().split("\n").forEach((line) => {
          ctx.fillText(line, 0, y_offset);
          let lineDimensions = ctx.measureText(line);
          this.left = Math.max(this.left, lineDimensions.actualBoundingBoxLeft);
          this.right = Math.max(this.right, lineDimensions.actualBoundingBoxRight);
          this.up = Math.max(this.up, lineDimensions.actualBoundingBoxAscent - y_offset);
          this.down = Math.max(this.down, -lineDimensions.actualBoundingBoxDescent + y_offset);
          if (lineDimensions.fontBoundingBoxAscent) {
            y_offset += lineDimensions.fontBoundingBoxAscent + lineDimensions.fontBoundingBoxDescent;
          } else {
            y_offset += this.fontSize * 1.15;
          }
        });
        ctx.restore();
        this.sin_angle = Math.sin(this.angle / 180 * Math.PI);
        this.cos_angle = Math.cos(this.angle / 180 * Math.PI);
      }
      move(diffX, diffY) {
        this.x = this.x + diffX;
        this.y = this.y + diffY;
        return true;
      }
      rotate(angle, center = null) {
        const angleDegrees = -angle * 180 / Math.PI;
        center = center || { x: this.x, y: this.y };
        if (center.x !== this.x || center.y !== this.y) {
          const dx = this.x - center.x;
          const dy = this.y - center.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const currentAngle = Math.atan2(dy, dx);
          const newAngle = currentAngle + angle;
          this.x = center.x + distance * Math.cos(newAngle);
          this.y = center.y + distance * Math.sin(newAngle);
        }
        this.angle = (this.angle + angleDegrees) % 360;
        if (this.angle < 0) {
          this.angle += 360;
        }
        return true;
      }
      scale(scale, center = null) {
        center = center || { x: this.x, y: this.y };
        if (center.x !== this.x || center.y !== this.y) {
          this.x = center.x + (this.x - center.x) * scale;
          this.y = center.y + (this.y - center.y) * scale;
        }
        this.fontSize *= scale;
        return true;
      }
      getDefaultCenter() {
        return { x: this.x, y: this.y };
      }
      onConstructMouseDown(mouse, ctrl, shift) {
        const mousePos = mouse.getPosSnappedToGrid();
        this.x = mousePos.x;
        this.y = mousePos.y;
        this.text = instance.t("simulator:sceneObjs.TextLabel.textHere");
      }
      onConstructMouseUp(mouse, ctrl, shift) {
        return {
          isDone: true
        };
      }
      checkMouseOver(mouse) {
        let dragContext = {};
        let relativeMouseX = mouse.pos.x - this.x;
        let relativeMouseY = mouse.pos.y - this.y;
        let rotatedMouseX = relativeMouseX * this.cos_angle - relativeMouseY * this.sin_angle;
        let rotatedMouseY = relativeMouseY * this.cos_angle + relativeMouseX * this.sin_angle;
        if (rotatedMouseX >= -this.left && rotatedMouseX <= this.right && rotatedMouseY <= this.down && rotatedMouseY >= -this.up) {
          dragContext.part = 0;
          dragContext.mousePos0 = geometry_default.point(mouse.pos.x, mouse.pos.y);
          dragContext.mousePos0Snapped = mouse.getPosSnappedToGrid();
          dragContext.targetPoint_ = geometry_default.point(this.x, this.y);
          dragContext.snapContext = {};
          return dragContext;
        }
      }
      onDrag(mouse, dragContext, ctrl, shift) {
        if (shift) {
          var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
        } else {
          var mousePos = mouse.getPosSnappedToGrid();
          dragContext.snapContext = {};
        }
        this.x = mousePos.x + dragContext.targetPoint_.x - dragContext.mousePos0Snapped.x;
        this.y = mousePos.y + dragContext.targetPoint_.y - dragContext.mousePos0Snapped.y;
      }
    };
    TextLabel_default = TextLabel;
  }
});

// app/node_modules/.pnpm/bezier-js@6.1.4/node_modules/bezier-js/src/utils.js
var abs, cos, sin, acos, atan2, sqrt, pow, pi, tau, quart, nMax, nMin;
var init_utils = __esm({
  "app/node_modules/.pnpm/bezier-js@6.1.4/node_modules/bezier-js/src/utils.js"() {
    init_bezier();
    ({ abs, cos, sin, acos, atan2, sqrt, pow } = Math);
    pi = Math.PI;
    tau = 2 * pi;
    quart = pi / 2;
    nMax = Number.MAX_SAFE_INTEGER || 9007199254740991;
    nMin = Number.MIN_SAFE_INTEGER || -9007199254740991;
  }
});

// app/node_modules/.pnpm/bezier-js@6.1.4/node_modules/bezier-js/src/poly-bezier.js
var init_poly_bezier = __esm({
  "app/node_modules/.pnpm/bezier-js@6.1.4/node_modules/bezier-js/src/poly-bezier.js"() {
    init_utils();
  }
});

// app/node_modules/.pnpm/bezier-js@6.1.4/node_modules/bezier-js/src/bezier.js
var abs2, min, max, cos2, sin2, acos2, sqrt2;
var init_bezier = __esm({
  "app/node_modules/.pnpm/bezier-js@6.1.4/node_modules/bezier-js/src/bezier.js"() {
    init_utils();
    init_poly_bezier();
    ({ abs: abs2, min, max, cos: cos2, sin: sin2, acos: acos2, sqrt: sqrt2 } = Math);
  }
});

// app/notices/ray-optics/source/Mouse.js
var Mouse, Mouse_default;
var init_Mouse = __esm({
  "app/notices/ray-optics/source/Mouse.js"() {
    "use strict";
    init_geometry();
    init_bezier();
    Mouse = class _Mouse {
      static CLICK_EXTENT_LINE = 10;
      static CLICK_EXTENT_POINT = 10;
      static TOUCHSCREEN_EXTENT_RATIO = 2;
      static SNAP_TO_DIRECTION_LOCK_LIMIT = 30;
      /**
       * Create a Mouse object.
       * @param {geometry.point} pos - The position of the mouse within the scene.
       * @param {Scene} scene - The scene in which the mouse operates.
       * @param {boolean} isTouch - Indicates whether the mouse input comes from a touch screen.
       * @param {number} overrideGrid - Indicates how the grid is overridden (0: not overridden, 1: invert the on/off of the grid, 2: always off).
       */
      constructor(pos, scene, isTouch = false, overrideGrid = 0) {
        this.pos = pos;
        this.scene = scene;
        this.isTouch = isTouch;
        this.overrideGrid = overrideGrid;
      }
      /**
       * Calculates the effective click extent based on whether the target is a point or a line,
       * and adjusts for touchscreen input if applicable.
       * @param {boolean} isPoint - Specifies whether the target is a point (true) or a line (false).
       * @returns {number} The calculated click extent.
       */
      getClickExtent(isPoint) {
        let clickExtent;
        if (isPoint) {
          clickExtent = _Mouse.CLICK_EXTENT_POINT / this.scene.scale;
        } else {
          clickExtent = _Mouse.CLICK_EXTENT_LINE / this.scene.scale;
        }
        if (this.isTouch) {
          clickExtent *= _Mouse.TOUCHSCREEN_EXTENT_RATIO;
        }
        return clickExtent;
      }
      /**
       * Determines if the mouse is currently over a given point.
       * @param {geometry.point} point - The point to check against the mouse position.
       * @returns {boolean} True if the mouse is on the given point, false otherwise.
       */
      isOnPoint(point) {
        return geometry_default.distanceSquared(this.pos, point) < this.getClickExtent(true) * this.getClickExtent(true);
      }
      /**
       * Determines if the snapped mouse is currently over a given point.
       * @param {geometry.point} point - The point to check against the snapped mouse position.
       * @returns {boolean} True if the snapped mouse is on the given point, false otherwise.
       */
      snapsOnPoint(point) {
        return geometry_default.distanceSquared(this.getPosSnappedToGrid(), point) < this.getClickExtent(true) * this.getClickExtent(true);
      }
      /**
       * Determines if the mouse is currently over a given line segment.
       * @param {geometry.line} segment - The line segment to check against the mouse position.
       * @returns {boolean} True if the mouse is on the given line segment, false otherwise.
       */
      isOnSegment(segment) {
        var d_per = Math.pow((this.pos.x - segment.p1.x) * (segment.p1.y - segment.p2.y) + (this.pos.y - segment.p1.y) * (segment.p2.x - segment.p1.x), 2) / ((segment.p1.y - segment.p2.y) * (segment.p1.y - segment.p2.y) + (segment.p2.x - segment.p1.x) * (segment.p2.x - segment.p1.x));
        var d_par = (segment.p2.x - segment.p1.x) * (this.pos.x - segment.p1.x) + (segment.p2.y - segment.p1.y) * (this.pos.y - segment.p1.y);
        return d_per < this.getClickExtent() * this.getClickExtent() && d_par >= 0 && d_par <= geometry_default.segmentLengthSquared(segment);
      }
      /**
       * Determines if the mouse is currently over a given curve.
       * @param {Bezier} curve - The curve to check against the mouse position.
       * @returns {boolean} True if the mouse is on the given curve, false otherwise.
       */
      isOnCurve(curve) {
        return curve.project(this.pos).d ** 2 < this.getClickExtent(true) * this.getClickExtent(true);
      }
      /**
       * Determines if the mouse is currently over a given line.
       * @param {geometry.line} line - The line to check against the mouse position.
       * @returns {boolean} True if the mouse is on the given line, false otherwise.
       */
      isOnLine(line) {
        var d_per = Math.pow((this.pos.x - line.p1.x) * (line.p1.y - line.p2.y) + (this.pos.y - line.p1.y) * (line.p2.x - line.p1.x), 2) / ((line.p1.y - line.p2.y) * (line.p1.y - line.p2.y) + (line.p2.x - line.p1.x) * (line.p2.x - line.p1.x));
        return d_per < this.getClickExtent() * this.getClickExtent();
      }
      /**
       * Get the mouse position snapped to the grid if the grid is enabled.
       * @returns {geometry.point} The mouse position snapped to the grid.
       */
      getPosSnappedToGrid() {
        if (this.overrideGrid === 0 && this.scene.snapToGrid || this.overrideGrid === 1 && !this.scene.snapToGrid) {
          return geometry_default.point(
            Math.round(this.pos.x / this.scene.gridSize) * this.scene.gridSize,
            Math.round(this.pos.y / this.scene.gridSize) * this.scene.gridSize
          );
        } else {
          return this.pos;
        }
      }
      /**
       * Get the mouse position snapped to a set of suggested directions.
       * @param {geometry.point} basePoint - The base point for the snapping.
       * @param {Array} directions - The directions to snap to, each a vector with x and y components.
       * @param {Object} snapContext - The object storing the internal state of the snapping process.
       * @returns {geometry.point} The mouse position snapped to some direction.
       */
      getPosSnappedToDirection(basePoint, directions, snapContext) {
        const pos = this.getPosSnappedToGrid();
        var x = pos.x - basePoint.x;
        var y = pos.y - basePoint.y;
        if (snapContext && snapContext.locked) {
          var k = (directions[snapContext.i0].x * x + directions[snapContext.i0].y * y) / (directions[snapContext.i0].x * directions[snapContext.i0].x + directions[snapContext.i0].y * directions[snapContext.i0].y);
          return geometry_default.point(basePoint.x + k * directions[snapContext.i0].x, basePoint.y + k * directions[snapContext.i0].y);
        } else {
          var i0;
          var d_sq;
          var d0_sq = Infinity;
          for (var i = 0; i < directions.length; i++) {
            d_sq = (directions[i].y * x - directions[i].x * y) * (directions[i].y * x - directions[i].x * y) / (directions[i].x * directions[i].x + directions[i].y * directions[i].y);
            if (d_sq < d0_sq) {
              d0_sq = d_sq;
              i0 = i;
            }
          }
          if (snapContext && x * x + y * y > _Mouse.SNAP_TO_DIRECTION_LOCK_LIMIT * _Mouse.SNAP_TO_DIRECTION_LOCK_LIMIT / this.scene.scale / this.scene.scale) {
            snapContext.locked = true;
            snapContext.i0 = i0;
          }
          var k = (directions[i0].x * x + directions[i0].y * y) / (directions[i0].x * directions[i0].x + directions[i0].y * directions[i0].y);
          return geometry_default.point(basePoint.x + k * directions[i0].x, basePoint.y + k * directions[i0].y);
        }
      }
    };
    Mouse_default = Mouse;
  }
});

// app/notices/ray-optics/source/sceneObjs/special/Handle.js
var Handle_exports = {};
__export(Handle_exports, {
  default: () => Handle_default
});
function promptNewModuleNameForHandle(scene) {
  const existing = Object.keys(scene.modules || {});
  const base = "NewModule";
  let defaultName = base;
  if (existing.includes(base)) {
    for (let i = 2; i < 1e4; i++) {
      const candidate = `${base}${i}`;
      if (!existing.includes(candidate)) {
        defaultName = candidate;
        break;
      }
    }
  }
  const proposed = window.prompt(
    instance.t("simulator:sidebar.visual.moduleEditor.new.promptNewName"),
    defaultName
  );
  if (proposed == null) return null;
  const newName = proposed.trim();
  if (!newName) {
    window.alert(instance.t("simulator:sidebar.visual.moduleEditor.new.errorEmptyName"));
    return null;
  }
  if (newName.includes(",")) {
    window.alert(instance.t("simulator:sidebar.visual.moduleEditor.new.errorComma"));
    return null;
  }
  if (existing.includes(newName)) {
    window.alert(instance.t("simulator:sidebar.visual.moduleEditor.new.errorNameExists", { name: newName }));
    return null;
  }
  return newName;
}
var Handle, Handle_default;
var init_Handle = __esm({
  "app/notices/ray-optics/source/sceneObjs/special/Handle.js"() {
    "use strict";
    init_BaseSceneObj();
    init_geometry();
    init_Mouse();
    init_i18next();
    Handle = class extends BaseSceneObj_default {
      static type = "Handle";
      static isOptical = true;
      // As the handle may bind to objects which are optical, this should be regarded as true.
      static serializableDefaults = {
        p1: null,
        p2: null,
        objIndices: [],
        controlPoints: [],
        transformation: "default",
        moveStep: 1,
        rotateStep: 0.5,
        scaleStep: 1,
        notDone: false
      };
      serialize() {
        let jsonObj = super.serialize();
        if (jsonObj.controlPoints) {
          jsonObj.controlPoints = jsonObj.controlPoints.map((controlPoint) => {
            let controlPointCopy = JSON.parse(JSON.stringify(controlPoint));
            delete controlPointCopy.dragContext.originalObj;
            delete controlPointCopy.dragContext.hasDuplicated;
            delete controlPointCopy.dragContext.isByHandle;
            delete controlPointCopy.dragContext.targetPoint;
            delete controlPointCopy.dragContext.snapContext;
            return controlPointCopy;
          });
        }
        return jsonObj;
      }
      static getDescription(objData, scene, detailed = false) {
        if (objData?.notDone) {
          const hint = instance.t("simulator:sceneObjs.Handle.placeOnCanvasHint");
          return `<span style='color:#fbbf24;font-weight:500'>${hint}</span>`;
        }
        const base = instance.t("simulator:sceneObjs.Handle.handle");
        if (!detailed) return base;
        const transformation = objData?.transformation || "default";
        const transformationLabel = transformation === "default" ? instance.t("simulator:common.legacyOption") : instance.t(`simulator:sceneObjs.Handle.transformations.${transformation}`);
        return instance.t("main:meta.colon", { name: base, value: transformationLabel });
      }
      static getPropertySchema(objData, scene) {
        const transformationOptions = {
          default: instance.t("simulator:common.legacyOption"),
          translation: instance.t("simulator:sceneObjs.Handle.transformations.translation"),
          xTranslation: instance.t("simulator:sceneObjs.Handle.transformations.xTranslation"),
          yTranslation: instance.t("simulator:sceneObjs.Handle.transformations.yTranslation"),
          rotation: instance.t("simulator:sceneObjs.Handle.transformations.rotation"),
          scaling: instance.t("simulator:sceneObjs.Handle.transformations.scaling")
        };
        const stepWord = instance.t("simulator:sceneObjs.Handle.step");
        return [
          { key: "p1", type: "point", label: instance.t("simulator:sceneObjs.Handle.handlePoint") },
          { key: "p2", type: "point", label: instance.t("simulator:sceneObjs.Handle.rotationScalingCenter") },
          {
            key: "transformation",
            type: "dropdown",
            label: instance.t("simulator:sceneObjs.Handle.transformation"),
            options: transformationOptions
          },
          {
            key: "moveStep",
            type: "number",
            label: instance.t("main:meta.parentheses", {
              main: stepWord,
              sub: instance.t("simulator:sceneObjs.Handle.transformations.translation")
            })
          },
          {
            key: "rotateStep",
            type: "number",
            label: instance.t("main:meta.parentheses", {
              main: stepWord,
              sub: instance.t("simulator:sceneObjs.Handle.transformations.rotation") + " \xB0"
            })
          },
          {
            key: "scaleStep",
            type: "number",
            label: instance.t("main:meta.parentheses", {
              main: stepWord,
              sub: instance.t("simulator:sceneObjs.Handle.transformations.scaling") + " %"
            })
          }
        ];
      }
      /**
       * Convert this handle into a new module (see {@link Scene#convertHandleToModule}).
       * @param {string} moduleName
       * @returns {{ok: boolean, moduleObjIndex: (number|undefined)}}
       */
      convertToModule(moduleName) {
        const idx = this.scene.objs.indexOf(this);
        if (idx < 0) {
          return { ok: false };
        }
        return this.scene.convertHandleToModule(idx, moduleName);
      }
      populateObjBar(objBar) {
        objBar.setTitle(instance.t("simulator:sceneObjs.Handle.handle"));
        const transformations = {
          "xTranslation": instance.t("simulator:sceneObjs.Handle.transformations.xTranslation"),
          "yTranslation": instance.t("simulator:sceneObjs.Handle.transformations.yTranslation"),
          "translation": instance.t("simulator:sceneObjs.Handle.transformations.translation"),
          "rotation": instance.t("simulator:sceneObjs.Handle.transformations.rotation"),
          "scaling": instance.t("simulator:sceneObjs.Handle.transformations.scaling"),
          "default": instance.t("simulator:common.legacyOption"),
          "_module": instance.t("simulator:sceneObjs.Handle.convertToModule")
        };
        objBar.createDropdown(instance.t("simulator:sceneObjs.Handle.transformation"), this.transformation, transformations, function(obj, value) {
          if (value === "_module") {
            const moduleName = promptNewModuleNameForHandle(obj.scene);
            if (moduleName == null) {
              setTimeout(function() {
                objBar.emit("requestUpdate", null);
              }, 0);
              return;
            }
            const result = obj.convertToModule(moduleName);
            if (!result.ok) {
              setTimeout(function() {
                objBar.emit("requestUpdate", null);
              }, 0);
              return;
            }
            const editor = obj.scene.editor;
            if (editor) {
              editor.selectObj(-1);
            }
            setTimeout(function() {
              document.dispatchEvent(new CustomEvent("selectSceneObjByIndex", { detail: { index: result.moduleObjIndex } }));
              document.dispatchEvent(new CustomEvent("openVisualModuleEditor", { detail: { moduleName } }));
            }, 0);
            return;
          }
          obj.transformation = value;
        }, null, true);
        switch (this.transformation) {
          case "xTranslation":
          case "yTranslation":
            objBar.createNumber(instance.t("simulator:sceneObjs.Handle.step"), 0, 100, 1, this.moveStep, function(obj, value) {
              obj.moveStep = Math.abs(value);
            }, instance.t("simulator:sceneObjs.common.lengthUnitInfo"), true);
            break;
          case "rotation":
            objBar.createNumber(instance.t("simulator:sceneObjs.Handle.step") + " (\xB0)", 0, 360, 1, this.rotateStep, function(obj, value) {
              obj.rotateStep = Math.abs(value);
            }, null, true);
            break;
          case "scaling":
            objBar.createNumber(instance.t("simulator:sceneObjs.Handle.step") + " (%)", 1, 200, 1, this.scaleStep, function(obj, value) {
              obj.scaleStep = value;
            }, null, true);
            break;
        }
      }
      getZIndex() {
        return -Infinity;
      }
      draw(canvasRenderer, isAboveLight, isHovered) {
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        ctx.lineWidth = 1.5 * ls;
        if (this.transformation == "default" || isHovered || this.notDone) {
          for (var i in this.controlPoints) {
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.strokeStyle = this.notDone ? this.scene.highlightColorCss : isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handlePoint.color);
            ctx.setLineDash([2.1 * ls, 2.1 * ls]);
            ctx.arc(this.controlPoints[i].newPoint.x, this.controlPoints[i].newPoint.y, 4 * ls, 0, Math.PI * 2, false);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        const arrowLineWidthCross = this.scene.theme.handleArrow.size / 24 * 5 * ls;
        const arrowLineWidthSingle = this.scene.theme.handleArrow.size / 24 * 8 * ls;
        const arrowLengthCross = this.scene.theme.handleArrow.size / 24 * 30 * ls;
        const arrowLengthSingle = this.scene.theme.handleArrow.size / 24 * 28 * ls;
        const arrowHeadSizeCross = this.scene.theme.handleArrow.size / 24 * 8 * ls;
        const arrowHeadSizeSingle = this.scene.theme.handleArrow.size / 24 * 12 * ls;
        if (!this.notDone) {
          ctx.globalAlpha = 1;
          switch (this.transformation) {
            case "default":
              ctx.beginPath();
              ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handlePoint.color);
              ctx.arc(this.p1.x, this.p1.y, 2 * ls, 0, Math.PI * 2, false);
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(this.p1.x, this.p1.y, 5 * ls, 0, Math.PI * 2, false);
              ctx.stroke();
              break;
            case "translation":
              ctx.beginPath();
              ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handleArrow.color);
              ctx.fillStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handleArrow.color);
              ctx.lineWidth = arrowLineWidthCross;
              ctx.moveTo(this.p1.x - arrowLengthCross / 2, this.p1.y);
              ctx.lineTo(this.p1.x + arrowLengthCross / 2, this.p1.y);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(this.p1.x, this.p1.y - arrowLengthCross / 2);
              ctx.lineTo(this.p1.x, this.p1.y + arrowLengthCross / 2);
              ctx.stroke();
              this.drawArrowHead(canvasRenderer, this.p1.x + (arrowLengthCross + arrowHeadSizeCross) / 2, this.p1.y, 0, arrowHeadSizeCross);
              this.drawArrowHead(canvasRenderer, this.p1.x, this.p1.y + (arrowLengthCross + arrowHeadSizeCross) / 2, Math.PI / 2, arrowHeadSizeCross);
              this.drawArrowHead(canvasRenderer, this.p1.x - (arrowLengthCross + arrowHeadSizeCross) / 2, this.p1.y, Math.PI, arrowHeadSizeCross);
              this.drawArrowHead(canvasRenderer, this.p1.x, this.p1.y - (arrowLengthCross + arrowHeadSizeCross) / 2, -Math.PI / 2, arrowHeadSizeCross);
              break;
            case "xTranslation":
              ctx.beginPath();
              ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handleArrow.color);
              ctx.fillStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handleArrow.color);
              ctx.lineWidth = arrowLineWidthSingle;
              ctx.moveTo(this.p1.x - arrowLengthSingle / 2, this.p1.y);
              ctx.lineTo(this.p1.x + arrowLengthSingle / 2, this.p1.y);
              ctx.stroke();
              this.drawArrowHead(canvasRenderer, this.p1.x + (arrowLengthSingle + arrowHeadSizeSingle) / 2, this.p1.y, 0, arrowHeadSizeSingle);
              this.drawArrowHead(canvasRenderer, this.p1.x - (arrowLengthSingle + arrowHeadSizeSingle) / 2, this.p1.y, Math.PI, arrowHeadSizeSingle);
              break;
            case "yTranslation":
              ctx.beginPath();
              ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handleArrow.color);
              ctx.fillStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handleArrow.color);
              ctx.lineWidth = arrowLineWidthSingle;
              ctx.moveTo(this.p1.x, this.p1.y - arrowLengthSingle / 2);
              ctx.lineTo(this.p1.x, this.p1.y + arrowLengthSingle / 2);
              ctx.stroke();
              this.drawArrowHead(canvasRenderer, this.p1.x, this.p1.y + (arrowLengthSingle + arrowHeadSizeSingle) / 2, Math.PI / 2, arrowHeadSizeSingle);
              this.drawArrowHead(canvasRenderer, this.p1.x, this.p1.y - (arrowLengthSingle + arrowHeadSizeSingle) / 2, -Math.PI / 2, arrowHeadSizeSingle);
              break;
            case "rotation":
              ctx.beginPath();
              ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handleArrow.color);
              ctx.fillStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handleArrow.color);
              ctx.lineWidth = arrowLineWidthSingle;
              const radius = 40 * ls;
              const angle = Math.atan2(this.p1.y - this.p2.y, this.p1.x - this.p2.x);
              const center = geometry_default.point(this.p1.x - radius * Math.cos(angle), this.p1.y - radius * Math.sin(angle));
              const angle1 = angle - arrowLengthSingle / radius / 2;
              const angle1_ = angle - (arrowLengthSingle + arrowHeadSizeSingle) / radius / 2;
              const angle2 = angle + arrowLengthSingle / radius / 2;
              const angle2_ = angle + (arrowLengthSingle + arrowHeadSizeSingle) / radius / 2;
              ctx.arc(center.x, center.y, radius, angle1, angle2);
              ctx.stroke();
              this.drawArrowHead(canvasRenderer, center.x + radius * Math.cos(angle2_), center.y + radius * Math.sin(angle2_), angle2 + Math.PI / 2, arrowHeadSizeSingle);
              this.drawArrowHead(canvasRenderer, center.x + radius * Math.cos(angle1_), center.y + radius * Math.sin(angle1_), angle1 - Math.PI / 2, arrowHeadSizeSingle);
              break;
            case "scaling":
              ctx.beginPath();
              ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handleArrow.color);
              ctx.fillStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handleArrow.color);
              ctx.lineWidth = arrowLineWidthSingle;
              const radialAngle = Math.atan2(this.p1.y - this.p2.y, this.p1.x - this.p2.x);
              const arrowHeadSizeLarge = this.scene.theme.handleArrow.size / 24 * 14 * ls;
              const arrowHeadSizeSmall = this.scene.theme.handleArrow.size / 24 * 10 * ls;
              ctx.beginPath();
              ctx.moveTo(this.p1.x - arrowLengthSingle / 2 * Math.cos(radialAngle), this.p1.y - arrowLengthSingle / 2 * Math.sin(radialAngle));
              ctx.lineTo(this.p1.x + arrowLengthSingle / 2 * Math.cos(radialAngle), this.p1.y + arrowLengthSingle / 2 * Math.sin(radialAngle));
              ctx.stroke();
              this.drawArrowHead(canvasRenderer, this.p1.x + (arrowLengthSingle + arrowHeadSizeLarge) / 2 * Math.cos(radialAngle), this.p1.y + (arrowLengthSingle + arrowHeadSizeLarge) / 2 * Math.sin(radialAngle), radialAngle, arrowHeadSizeLarge);
              this.drawArrowHead(canvasRenderer, this.p1.x - (arrowLengthSingle + arrowHeadSizeSmall) / 2 * Math.cos(radialAngle), this.p1.y - (arrowLengthSingle + arrowHeadSizeSmall) / 2 * Math.sin(radialAngle), radialAngle + Math.PI, arrowHeadSizeSmall);
          }
          ctx.lineWidth = 1 * ls;
          if (this.transformation == "default" || this.transformation == "rotation" || this.transformation == "scaling") {
            ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handlePoint.color);
            ctx.beginPath();
            ctx.moveTo(this.p2.x - 5 * ls, this.p2.y);
            ctx.lineTo(this.p2.x + 5 * ls, this.p2.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(this.p2.x, this.p2.y - 5 * ls);
            ctx.lineTo(this.p2.x, this.p2.y + 5 * ls);
            ctx.stroke();
          }
        }
      }
      move(diffX, diffY) {
        if (this.notDone) return;
        this.p1.x = this.p1.x + diffX;
        this.p1.y = this.p1.y + diffY;
        this.p2.x = this.p2.x + diffX;
        this.p2.y = this.p2.y + diffY;
        let allSuccess = true;
        let unsupportedType = null;
        for (var i in this.objIndices) {
          const obj = this.scene.objs[this.objIndices[i]];
          const result = obj.move(diffX, diffY);
          if (!result) {
            unsupportedType = obj.constructor.type;
            allSuccess = false;
          }
        }
        for (var i in this.controlPoints) {
          this.controlPoints[i].dragContext.originalObj = this.scene.objs[this.controlPoints[i].targetObjIndex].serialize();
          this.controlPoints[i].dragContext.isByHandle = true;
          this.controlPoints[i].dragContext.hasDuplicated = false;
          this.controlPoints[i].dragContext.targetPoint = { x: this.controlPoints[i].newPoint.x, y: this.controlPoints[i].newPoint.y };
          this.controlPoints[i].dragContext.snapContext = {};
          this.controlPoints[i].newPoint.x = this.controlPoints[i].newPoint.x + diffX;
          this.controlPoints[i].newPoint.y = this.controlPoints[i].newPoint.y + diffY;
          this.scene.objs[this.controlPoints[i].targetObjIndex].onDrag(new Mouse_default(JSON.parse(JSON.stringify(this.controlPoints[i].newPoint)), this.scene, false, 2), JSON.parse(JSON.stringify(this.controlPoints[i].dragContext)), false, false);
        }
        if (!allSuccess) {
          this.warning = instance.t("simulator:sceneObjs.Handle.transformationWarning", {
            obj: unsupportedType,
            transformation: instance.t("simulator:sceneObjs.Handle.transformations.translation")
          });
        } else {
          this.warning = null;
        }
        return allSuccess;
      }
      rotate(angle, center = null) {
        if (this.notDone) return;
        center = center || this.p2;
        let x = this.p1.x - center.x;
        let y = this.p1.y - center.y;
        this.p1.x = Math.cos(angle) * x - Math.sin(angle) * y + center.x;
        this.p1.y = Math.sin(angle) * x + Math.cos(angle) * y + center.y;
        if (center !== this.p2) {
          x = this.p2.x - center.x;
          y = this.p2.y - center.y;
          this.p2.x = Math.cos(angle) * x - Math.sin(angle) * y + center.x;
          this.p2.y = Math.sin(angle) * x + Math.cos(angle) * y + center.y;
        }
        let allSuccess = true;
        let unsupportedType = null;
        for (var i in this.objIndices) {
          const obj = this.scene.objs[this.objIndices[i]];
          const result = obj.rotate(angle, center);
          if (!result) {
            unsupportedType = obj.constructor.type;
            allSuccess = false;
          }
        }
        for (var i in this.controlPoints) {
          this.controlPoints[i].dragContext.originalObj = this.scene.objs[this.controlPoints[i].targetObjIndex].serialize();
          this.controlPoints[i].dragContext.isByHandle = true;
          this.controlPoints[i].dragContext.hasDuplicated = false;
          this.controlPoints[i].dragContext.targetPoint = { x: this.controlPoints[i].newPoint.x, y: this.controlPoints[i].newPoint.y };
          this.controlPoints[i].dragContext.snapContext = {};
          x = this.controlPoints[i].newPoint.x - center.x;
          y = this.controlPoints[i].newPoint.y - center.y;
          this.controlPoints[i].newPoint.x = Math.cos(angle) * x - Math.sin(angle) * y + center.x;
          this.controlPoints[i].newPoint.y = Math.sin(angle) * x + Math.cos(angle) * y + center.y;
          this.scene.objs[this.controlPoints[i].targetObjIndex].onDrag(
            new Mouse_default(JSON.parse(JSON.stringify(this.controlPoints[i].newPoint)), this.scene, false, 2),
            JSON.parse(JSON.stringify(this.controlPoints[i].dragContext)),
            false,
            false
          );
        }
        if (!allSuccess) {
          this.warning = instance.t("simulator:sceneObjs.Handle.transformationWarning", {
            obj: unsupportedType,
            transformation: instance.t("simulator:sceneObjs.Handle.transformations.rotation")
          });
        } else {
          this.warning = null;
        }
        return allSuccess;
      }
      scale(scale, center = null) {
        if (this.notDone) return;
        center = center || this.p2;
        this.p1.x = (this.p1.x - center.x) * scale + center.x;
        this.p1.y = (this.p1.y - center.y) * scale + center.y;
        if (center !== this.p2) {
          this.p2.x = (this.p2.x - center.x) * scale + center.x;
          this.p2.y = (this.p2.y - center.y) * scale + center.y;
        }
        let allSuccess = true;
        let unsupportedType = null;
        for (var i in this.objIndices) {
          const obj = this.scene.objs[this.objIndices[i]];
          const result = obj.scale(scale, center);
          if (!result) {
            unsupportedType = obj.constructor.type;
            allSuccess = false;
          }
        }
        for (var i in this.controlPoints) {
          this.controlPoints[i].dragContext.originalObj = this.scene.objs[this.controlPoints[i].targetObjIndex].serialize();
          this.controlPoints[i].dragContext.isByHandle = true;
          this.controlPoints[i].dragContext.hasDuplicated = false;
          this.controlPoints[i].dragContext.targetPoint = { x: this.controlPoints[i].newPoint.x, y: this.controlPoints[i].newPoint.y };
          this.controlPoints[i].dragContext.snapContext = {};
          this.controlPoints[i].newPoint.x = (this.controlPoints[i].newPoint.x - center.x) * scale + center.x;
          this.controlPoints[i].newPoint.y = (this.controlPoints[i].newPoint.y - center.y) * scale + center.y;
          this.scene.objs[this.controlPoints[i].targetObjIndex].onDrag(
            new Mouse_default(JSON.parse(JSON.stringify(this.controlPoints[i].newPoint)), this.scene, false, 2),
            JSON.parse(JSON.stringify(this.controlPoints[i].dragContext)),
            false,
            false
          );
        }
        if (!allSuccess) {
          this.warning = instance.t("simulator:sceneObjs.Handle.transformationWarning", {
            obj: unsupportedType,
            transformation: instance.t("simulator:sceneObjs.Handle.transformations.scaling")
          });
        } else {
          this.warning = null;
        }
        return allSuccess;
      }
      checkMouseOver(mouse) {
        let dragContext = {};
        if (this.notDone) return;
        if (mouse.isOnPoint(this.p1) || this.transformation != "default" && geometry_default.distance(this.p1, mouse.pos) < this.scene.theme.handleArrow.size / 24 * 20 * this.scene.lengthScale) {
          dragContext.part = 1;
          dragContext.targetPoint_ = geometry_default.point(this.p1.x, this.p1.y);
          dragContext.mousePos0 = geometry_default.point(this.p1.x, this.p1.y);
          dragContext.snapContext = {};
          return dragContext;
        }
        if ((this.transformation == "default" || this.transformation == "rotation" || this.transformation == "scaling") && mouse.isOnPoint(this.p2)) {
          dragContext.part = 2;
          dragContext.targetPoint = geometry_default.point(this.p2.x, this.p2.y);
          dragContext.mousePos0 = geometry_default.point(this.p2.x, this.p2.y);
          dragContext.snapContext = {};
          return dragContext;
        }
      }
      onDrag(mouse, dragContext, ctrl, shift) {
        if (this.notDone) return;
        if (shift) {
          var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
        } else {
          var mousePos = mouse.getPosSnappedToGrid();
          dragContext.snapContext = {};
        }
        if (dragContext.part == 1) {
          if (ctrl && shift || this.transformation == "scaling") {
            var factor = geometry_default.distance(this.p2, mouse.pos) / geometry_default.distance(this.p2, dragContext.targetPoint_);
            if (factor < 1e-5) return;
            if (this.scaleStep !== 0) {
              const stepFactor = this.scaleStep > 0 ? 1 + this.scaleStep / 100 : 1 / (1 - Math.abs(this.scaleStep) / 100);
              const stepCount = Math.round(Math.log(factor) / Math.log(stepFactor));
              factor = Math.pow(stepFactor, stepCount);
            }
            this.scale(factor, this.p2);
          } else if (ctrl || this.transformation == "rotation") {
            var theta = Math.atan2(this.p2.y - mouse.pos.y, this.p2.x - mouse.pos.x) - Math.atan2(this.p2.y - dragContext.targetPoint_.y, this.p2.x - dragContext.targetPoint_.x);
            if (this.rotateStep > 0) {
              const stepRadians = this.rotateStep * Math.PI / 180;
              while (theta > Math.PI) theta -= 2 * Math.PI;
              while (theta <= -Math.PI) theta += 2 * Math.PI;
              theta = Math.round(theta / stepRadians) * stepRadians;
            }
            this.rotate(theta, this.p2);
          } else {
            var diffX = this.transformation == "yTranslation" ? 0 : mousePos.x - dragContext.targetPoint_.x;
            var diffY = this.transformation == "xTranslation" ? 0 : mousePos.y - dragContext.targetPoint_.y;
            if (this.moveStep > 0) {
              const step = this.moveStep * this.scene.lengthScale;
              diffX = Math.round(diffX / step) * step;
              diffY = Math.round(diffY / step) * step;
            }
            this.move(diffX, diffY);
          }
          dragContext.targetPoint_.x = this.p1.x;
          dragContext.targetPoint_.y = this.p1.y;
        }
        if (dragContext.part == 2) {
          this.p2.x = mousePos.x;
          this.p2.y = mousePos.y;
        }
      }
      /**
       * Add (bind) a control point to the handle.
       * @param {ControlPoint} controlPoint - The control point to be bound.
       */
      addControlPoint(controlPoint) {
        controlPoint.dragContext.originalObj = this.scene.objs[controlPoint.targetObjIndex];
        controlPoint.dragContext.isByHandle = true;
        controlPoint.dragContext.hasDuplicated = false;
        controlPoint.newPoint = controlPoint.dragContext.targetPoint;
        controlPoint = JSON.parse(JSON.stringify(controlPoint));
        this.controlPoints.push(controlPoint);
      }
      /**
       * Add (bind) an entire object to the handle.
       * @param {number} objIndex - The index of the object to be bound.
       */
      addObject(objIndex) {
        if (!this.objIndices.includes(objIndex)) {
          this.objIndices.push(objIndex);
        }
      }
      /**
       * Finish creating the handle.
       * @param {Point} point - The position of the handle.
       */
      finishHandle(point) {
        this.p1 = point;
        let totalX = 0;
        let totalY = 0;
        let pointCount = 0;
        for (let i in this.controlPoints) {
          totalX += this.controlPoints[i].newPoint.x;
          totalY += this.controlPoints[i].newPoint.y;
          pointCount++;
        }
        for (let i in this.objIndices) {
          const obj = this.scene.objs[this.objIndices[i]];
          const defaultCenter = obj.getDefaultCenter && obj.getDefaultCenter();
          if (defaultCenter) {
            totalX += defaultCenter.x;
            totalY += defaultCenter.y;
            pointCount++;
          }
        }
        if (pointCount > 0) {
          this.p2 = geometry_default.point(totalX / pointCount, totalY / pointCount);
        } else {
          const centerX = (this.scene.width * 0.5 - this.scene.origin.x) / this.scene.scale;
          const centerY = (this.scene.height * 0.5 - this.scene.origin.y) / this.scene.scale;
          this.p2 = geometry_default.point(centerX, centerY);
        }
        this.notDone = false;
      }
      /**
       * Draw an filled arrow head at the given position with the given angle and size.
       * @param {CanvasRenderer} canvasRenderer - The canvas renderer.
       * @param {number} x - The x-coordinate of the arrow head.
       * @param {number} y - The y-coordinate of the arrow head.
       * @param {number} angle - The angle of the arrow head.
       * @param {number} size - The size of the arrow head.
       */
      drawArrowHead(canvasRenderer, x, y, angle, size) {
        const ctx = canvasRenderer.ctx;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, -size);
        ctx.lineTo(-size, size);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    };
    Handle_default = Handle;
  }
});

// app/notices/ray-optics/source/sceneObjs/special/CropBox.js
var CropBox_exports = {};
__export(CropBox_exports, {
  default: () => CropBox_default
});
var CropBox, CropBox_default;
var init_CropBox = __esm({
  "app/notices/ray-optics/source/sceneObjs/special/CropBox.js"() {
    "use strict";
    init_BaseSceneObj();
    init_geometry();
    init_i18next();
    CropBox = class extends BaseSceneObj_default {
      static type = "CropBox";
      static serializableDefaults = {
        p1: null,
        p4: null,
        format: "png",
        width: 1920,
        rayCountLimit: null,
        transparent: false
      };
      constructor(scene, jsonObj) {
        super(scene, jsonObj);
        if (this.p1 && this.p4) {
          this.p2 = geometry_default.point(this.p4.x, this.p1.y);
          this.p3 = geometry_default.point(this.p1.x, this.p4.y);
        }
      }
      static getDescription(objData, scene, detailed = false) {
        return instance.t("simulator:sceneObjs.CropBox.label");
      }
      populateObjBar(objBar) {
        objBar.setTitle(instance.t("simulator:sceneObjs.CropBox.title"));
        var width = geometry_default.distance(this.p1, this.p2);
        var height = geometry_default.distance(this.p1, this.p3);
        objBar.createNumber(instance.t("simulator:sceneObjs.CropBox.cropBoxSize"), 0, 1e3, 1, width, function(obj2, value) {
          obj2.p2 = geometry_default.point(obj2.p1.x + 1 * value, obj2.p2.y);
          obj2.p4 = geometry_default.point(obj2.p3.x + 1 * value, obj2.p4.y);
        }, null, true);
        objBar.createNumber("x", 0, 1e3, 1, height, function(obj2, value) {
          obj2.p3 = geometry_default.point(obj2.p3.x, obj2.p1.y + 1 * value);
          obj2.p4 = geometry_default.point(obj2.p4.x, obj2.p2.y + 1 * value);
        }, null, true);
        objBar.createDropdown(instance.t("simulator:sceneObjs.CropBox.format"), this.format, {
          "png": "PNG",
          "svg": "SVG"
        }, function(obj2, value) {
          obj2.format = value;
        }, null, true);
        if (this.format != "svg") {
          objBar.createNumber(instance.t("simulator:sceneObjs.CropBox.width"), 0, 1e3, 1, this.width, function(obj2, value) {
            obj2.width = 1 * value;
          }, null, true);
        }
        const rayCountLimit = this.rayCountLimit || (this.format === "svg" ? 1e4 : 1e7);
        if (objBar.showAdvanced(!this.arePropertiesDefault(["rayCountLimit", "transparent"]))) {
          objBar.createNumber(instance.t("simulator:sceneObjs.CropBox.rayCountLimit"), 0, 1e7, 1, rayCountLimit, function(obj2, value) {
            obj2.rayCountLimit = value;
            if (obj2.scene.simulator.processedRayCount > obj2.rayCountLimit) {
              obj2.warning = instance.t("simulator:sceneObjs.CropBox.rayCountWarning");
            } else {
              obj2.warning = null;
            }
          }, null, true);
          objBar.createBoolean(instance.t("simulator:sceneObjs.CropBox.transparent"), this.transparent, function(obj2, value) {
            obj2.transparent = value;
          });
        }
        const self2 = this;
        objBar.createButton(instance.t("simulator:common.saveButton"), function(obj2) {
          self2.warning = null;
          self2.scene.editor.confirmCrop(obj2);
        });
        objBar.createButton(instance.t("simulator:common.cancelButton"), function(obj2) {
          self2.warning = null;
          self2.scene.editor.cancelCrop();
        });
        this.warning = null;
        if (this.format === "svg") {
          if (this.scene.simulateColors || this.scene.colorMode !== "default") {
            this.warning = instance.t("simulator:sceneObjs.CropBox.svgWarning");
          }
          for (var obj of this.scene.opticalObjs) {
            if (obj.refIndex && obj.refIndex < 1) {
              this.warning = instance.t("simulator:sceneObjs.CropBox.svgWarning");
              break;
            }
          }
        }
        if (this.scene.simulator.processedRayCount > rayCountLimit) {
          this.warning = instance.t("simulator:sceneObjs.CropBox.rayCountWarning");
        }
      }
      draw(canvasRenderer, isAboveLight, isHovered) {
        if (!(this.scene.editor && this.scene.editor.isInCropMode)) return;
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;
        ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.decoration.color);
        ctx.lineWidth = 1 * ls;
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.lineTo(this.p4.x, this.p4.y);
        ctx.lineTo(this.p3.x, this.p3.y);
        ctx.lineTo(this.p1.x, this.p1.y);
        ctx.stroke();
        ctx.fillStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.decoration.color);
        ctx.beginPath();
        ctx.arc(this.p1.x, this.p1.y, 5 * ls, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.p2.x, this.p2.y, 5 * ls, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.p3.x, this.p3.y, 5 * ls, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.p4.x, this.p4.y, 5 * ls, 0, 2 * Math.PI);
        ctx.fill();
      }
      move(diffX, diffY) {
        this.p1.x += diffX;
        this.p1.y += diffY;
        this.p2.x += diffX;
        this.p2.y += diffY;
        this.p3.x += diffX;
        this.p3.y += diffY;
        this.p4.x += diffX;
        this.p4.y += diffY;
        return true;
      }
      scale(scale, center = null) {
        center = center || this.getDefaultCenter();
        this.p1.x = center.x + (this.p1.x - center.x) * scale;
        this.p1.y = center.y + (this.p1.y - center.y) * scale;
        this.p2.x = center.x + (this.p2.x - center.x) * scale;
        this.p2.y = center.y + (this.p2.y - center.y) * scale;
        this.p3.x = center.x + (this.p3.x - center.x) * scale;
        this.p3.y = center.y + (this.p3.y - center.y) * scale;
        this.p4.x = center.x + (this.p4.x - center.x) * scale;
        this.p4.y = center.y + (this.p4.y - center.y) * scale;
        return true;
      }
      getDefaultCenter() {
        return {
          x: (this.p1.x + this.p2.x + this.p3.x + this.p4.x) / 4,
          y: (this.p1.y + this.p2.y + this.p3.y + this.p4.y) / 4
        };
      }
      checkMouseOver(mouse) {
        if (!(this.scene.editor && this.scene.editor.isInCropMode)) return false;
        if (mouse.isOnPoint(this.p1)) {
          return { part: 1, targetPoint: geometry_default.point(this.p1.x, this.p1.y), cursor: "nwse-resize", requiresObjBarUpdate: true };
        }
        if (mouse.isOnPoint(this.p2)) {
          return { part: 2, targetPoint: geometry_default.point(this.p2.x, this.p2.y), cursor: "nesw-resize", requiresObjBarUpdate: true };
        }
        if (mouse.isOnPoint(this.p3)) {
          return { part: 3, targetPoint: geometry_default.point(this.p3.x, this.p3.y), cursor: "nesw-resize", requiresObjBarUpdate: true };
        }
        if (mouse.isOnPoint(this.p4)) {
          return { part: 4, targetPoint: geometry_default.point(this.p4.x, this.p4.y), cursor: "nwse-resize", requiresObjBarUpdate: true };
        }
        if (mouse.isOnSegment(geometry_default.line(this.p1, this.p2))) {
          return { part: 5, cursor: "ns-resize", requiresObjBarUpdate: true };
        }
        if (mouse.isOnSegment(geometry_default.line(this.p2, this.p4))) {
          return { part: 6, cursor: "ew-resize", requiresObjBarUpdate: true };
        }
        if (mouse.isOnSegment(geometry_default.line(this.p3, this.p4))) {
          return { part: 7, cursor: "ns-resize", requiresObjBarUpdate: true };
        }
        if (mouse.isOnSegment(geometry_default.line(this.p1, this.p3))) {
          return { part: 8, cursor: "ew-resize", requiresObjBarUpdate: true };
        }
        const mousePos = mouse.getPosSnappedToGrid();
        if (this.p1.x < mousePos.x && mousePos.x < this.p2.x && this.p1.y < mousePos.y && mousePos.y < this.p3.y) {
          return { part: 0, mousePos0: mousePos, mousePos1: mousePos, snapContext: {} };
        }
      }
      onDrag(mouse, dragContext, ctrl, shift) {
        const mousePos = mouse.getPosSnappedToGrid();
        if (dragContext.part == 1) {
          this.p1.x = mousePos.x;
          this.p1.y = mousePos.y;
          this.p2.y = mousePos.y;
          this.p3.x = mousePos.x;
        } else if (dragContext.part == 2) {
          this.p2.x = mousePos.x;
          this.p2.y = mousePos.y;
          this.p1.y = mousePos.y;
          this.p4.x = mousePos.x;
        } else if (dragContext.part == 3) {
          this.p3.x = mousePos.x;
          this.p3.y = mousePos.y;
          this.p1.x = mousePos.x;
          this.p4.y = mousePos.y;
        } else if (dragContext.part == 4) {
          this.p4.x = mousePos.x;
          this.p4.y = mousePos.y;
          this.p2.x = mousePos.x;
          this.p3.y = mousePos.y;
        } else if (dragContext.part == 5) {
          this.p1.y = mousePos.y;
          this.p2.y = mousePos.y;
        } else if (dragContext.part == 6) {
          this.p2.x = mousePos.x;
          this.p4.x = mousePos.x;
        } else if (dragContext.part == 7) {
          this.p3.y = mousePos.y;
          this.p4.y = mousePos.y;
        } else if (dragContext.part == 8) {
          this.p1.x = mousePos.x;
          this.p3.x = mousePos.x;
        } else if (dragContext.part == 0) {
          const mousePosSnapped = shift ? mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext) : mouse.getPosSnappedToGrid();
          const mouseDiffX = dragContext.mousePos1.x - mousePosSnapped.x;
          const mouseDiffY = dragContext.mousePos1.y - mousePosSnapped.y;
          this.p1.x -= mouseDiffX;
          this.p1.y -= mouseDiffY;
          this.p2.x -= mouseDiffX;
          this.p2.y -= mouseDiffY;
          this.p3.x -= mouseDiffX;
          this.p3.y -= mouseDiffY;
          this.p4.x -= mouseDiffX;
          this.p4.y -= mouseDiffY;
          dragContext.mousePos1 = mousePosSnapped;
        }
      }
    };
    CropBox_default = CropBox;
  }
});

// app/notices/ray-optics/source/sceneObjs.js
var sceneObjs_exports = {};
__export(sceneObjs_exports, {
  Beam: () => Beam2,
  Blocker: () => Blocker2,
  CircleGlass: () => CircleGlass2,
  CropBox: () => CropBox2,
  Detector: () => Detector,
  Handle: () => Handle2,
  IdealLens: () => IdealLens2,
  Mirror: () => Mirror2,
  PlaneGlass: () => PlaneGlass2,
  Ruler: () => Ruler2,
  SingleRay: () => SingleRay2,
  TextLabel: () => TextLabel2
});
var SingleRay2, Beam2, Mirror2, PlaneGlass2, CircleGlass2, IdealLens2, Blocker2, Ruler2, Detector, TextLabel2, Handle2, CropBox2;
var init_sceneObjs = __esm({
  "app/notices/ray-optics/source/sceneObjs.js"() {
    "use strict";
    SingleRay2 = (init_SingleRay(), __toCommonJS(SingleRay_exports)).default;
    Beam2 = (init_Beam(), __toCommonJS(Beam_exports)).default;
    Mirror2 = (init_Mirror(), __toCommonJS(Mirror_exports)).default;
    PlaneGlass2 = (init_PlaneGlass(), __toCommonJS(PlaneGlass_exports)).default;
    CircleGlass2 = (init_CircleGlass(), __toCommonJS(CircleGlass_exports)).default;
    IdealLens2 = (init_IdealLens(), __toCommonJS(IdealLens_exports)).default;
    Blocker2 = (init_Blocker(), __toCommonJS(Blocker_exports)).default;
    Ruler2 = (init_Ruler(), __toCommonJS(Ruler_exports)).default;
    Detector = (init_Detector(), __toCommonJS(Detector_exports)).default;
    TextLabel2 = (init_TextLabel(), __toCommonJS(TextLabel_exports)).default;
    Handle2 = (init_Handle(), __toCommonJS(Handle_exports)).default;
    CropBox2 = (init_CropBox(), __toCommonJS(CropBox_exports)).default;
  }
});

// app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/alea.js
var require_alea = __commonJS({
  "app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/alea.js"(exports, module) {
    (function(global2, module2, define2) {
      function Alea(seed) {
        var me = this, mash = Mash();
        me.next = function() {
          var t3 = 2091639 * me.s0 + me.c * 23283064365386963e-26;
          me.s0 = me.s1;
          me.s1 = me.s2;
          return me.s2 = t3 - (me.c = t3 | 0);
        };
        me.c = 1;
        me.s0 = mash(" ");
        me.s1 = mash(" ");
        me.s2 = mash(" ");
        me.s0 -= mash(seed);
        if (me.s0 < 0) {
          me.s0 += 1;
        }
        me.s1 -= mash(seed);
        if (me.s1 < 0) {
          me.s1 += 1;
        }
        me.s2 -= mash(seed);
        if (me.s2 < 0) {
          me.s2 += 1;
        }
        mash = null;
      }
      function copy2(f, t3) {
        t3.c = f.c;
        t3.s0 = f.s0;
        t3.s1 = f.s1;
        t3.s2 = f.s2;
        return t3;
      }
      function impl(seed, opts) {
        var xg = new Alea(seed), state = opts && opts.state, prng = xg.next;
        prng.int32 = function() {
          return xg.next() * 4294967296 | 0;
        };
        prng.double = function() {
          return prng() + (prng() * 2097152 | 0) * 11102230246251565e-32;
        };
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy2(state, xg);
          prng.state = function() {
            return copy2(xg, {});
          };
        }
        return prng;
      }
      function Mash() {
        var n = 4022871197;
        var mash = function(data) {
          data = String(data);
          for (var i = 0; i < data.length; i++) {
            n += data.charCodeAt(i);
            var h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 4294967296;
          }
          return (n >>> 0) * 23283064365386963e-26;
        };
        return mash;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.alea = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xor128.js
var require_xor128 = __commonJS({
  "app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xor128.js"(exports, module) {
    (function(global2, module2, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.x = 0;
        me.y = 0;
        me.z = 0;
        me.w = 0;
        me.next = function() {
          var t3 = me.x ^ me.x << 11;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          return me.w ^= me.w >>> 19 ^ t3 ^ t3 >>> 8;
        };
        if (seed === (seed | 0)) {
          me.x = seed;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 64; k++) {
          me.x ^= strseed.charCodeAt(k) | 0;
          me.next();
        }
      }
      function copy2(f, t3) {
        t3.x = f.x;
        t3.y = f.y;
        t3.z = f.z;
        t3.w = f.w;
        return t3;
      }
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy2(state, xg);
          prng.state = function() {
            return copy2(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xor128 = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xorwow.js
var require_xorwow = __commonJS({
  "app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xorwow.js"(exports, module) {
    (function(global2, module2, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.next = function() {
          var t3 = me.x ^ me.x >>> 2;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          me.w = me.v;
          return (me.d = me.d + 362437 | 0) + (me.v = me.v ^ me.v << 4 ^ (t3 ^ t3 << 1)) | 0;
        };
        me.x = 0;
        me.y = 0;
        me.z = 0;
        me.w = 0;
        me.v = 0;
        if (seed === (seed | 0)) {
          me.x = seed;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 64; k++) {
          me.x ^= strseed.charCodeAt(k) | 0;
          if (k == strseed.length) {
            me.d = me.x << 10 ^ me.x >>> 4;
          }
          me.next();
        }
      }
      function copy2(f, t3) {
        t3.x = f.x;
        t3.y = f.y;
        t3.z = f.z;
        t3.w = f.w;
        t3.v = f.v;
        t3.d = f.d;
        return t3;
      }
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy2(state, xg);
          prng.state = function() {
            return copy2(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xorwow = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xorshift7.js
var require_xorshift7 = __commonJS({
  "app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xorshift7.js"(exports, module) {
    (function(global2, module2, define2) {
      function XorGen(seed) {
        var me = this;
        me.next = function() {
          var X = me.x, i = me.i, t3, v, w;
          t3 = X[i];
          t3 ^= t3 >>> 7;
          v = t3 ^ t3 << 24;
          t3 = X[i + 1 & 7];
          v ^= t3 ^ t3 >>> 10;
          t3 = X[i + 3 & 7];
          v ^= t3 ^ t3 >>> 3;
          t3 = X[i + 4 & 7];
          v ^= t3 ^ t3 << 7;
          t3 = X[i + 7 & 7];
          t3 = t3 ^ t3 << 13;
          v ^= t3 ^ t3 << 9;
          X[i] = v;
          me.i = i + 1 & 7;
          return v;
        };
        function init2(me2, seed2) {
          var j, w, X = [];
          if (seed2 === (seed2 | 0)) {
            w = X[0] = seed2;
          } else {
            seed2 = "" + seed2;
            for (j = 0; j < seed2.length; ++j) {
              X[j & 7] = X[j & 7] << 15 ^ seed2.charCodeAt(j) + X[j + 1 & 7] << 13;
            }
          }
          while (X.length < 8) X.push(0);
          for (j = 0; j < 8 && X[j] === 0; ++j) ;
          if (j == 8) w = X[7] = -1;
          else w = X[j];
          me2.x = X;
          me2.i = 0;
          for (j = 256; j > 0; --j) {
            me2.next();
          }
        }
        init2(me, seed);
      }
      function copy2(f, t3) {
        t3.x = f.x.slice();
        t3.i = f.i;
        return t3;
      }
      function impl(seed, opts) {
        if (seed == null) seed = +/* @__PURE__ */ new Date();
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (state.x) copy2(state, xg);
          prng.state = function() {
            return copy2(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xorshift7 = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xor4096.js
var require_xor4096 = __commonJS({
  "app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xor4096.js"(exports, module) {
    (function(global2, module2, define2) {
      function XorGen(seed) {
        var me = this;
        me.next = function() {
          var w = me.w, X = me.X, i = me.i, t3, v;
          me.w = w = w + 1640531527 | 0;
          v = X[i + 34 & 127];
          t3 = X[i = i + 1 & 127];
          v ^= v << 13;
          t3 ^= t3 << 17;
          v ^= v >>> 15;
          t3 ^= t3 >>> 12;
          v = X[i] = v ^ t3;
          me.i = i;
          return v + (w ^ w >>> 16) | 0;
        };
        function init2(me2, seed2) {
          var t3, v, i, j, w, X = [], limit = 128;
          if (seed2 === (seed2 | 0)) {
            v = seed2;
            seed2 = null;
          } else {
            seed2 = seed2 + "\0";
            v = 0;
            limit = Math.max(limit, seed2.length);
          }
          for (i = 0, j = -32; j < limit; ++j) {
            if (seed2) v ^= seed2.charCodeAt((j + 32) % seed2.length);
            if (j === 0) w = v;
            v ^= v << 10;
            v ^= v >>> 15;
            v ^= v << 4;
            v ^= v >>> 13;
            if (j >= 0) {
              w = w + 1640531527 | 0;
              t3 = X[j & 127] ^= v + w;
              i = 0 == t3 ? i + 1 : 0;
            }
          }
          if (i >= 128) {
            X[(seed2 && seed2.length || 0) & 127] = -1;
          }
          i = 127;
          for (j = 4 * 128; j > 0; --j) {
            v = X[i + 34 & 127];
            t3 = X[i = i + 1 & 127];
            v ^= v << 13;
            t3 ^= t3 << 17;
            v ^= v >>> 15;
            t3 ^= t3 >>> 12;
            X[i] = v ^ t3;
          }
          me2.w = w;
          me2.X = X;
          me2.i = i;
        }
        init2(me, seed);
      }
      function copy2(f, t3) {
        t3.i = f.i;
        t3.w = f.w;
        t3.X = f.X.slice();
        return t3;
      }
      ;
      function impl(seed, opts) {
        if (seed == null) seed = +/* @__PURE__ */ new Date();
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (state.X) copy2(state, xg);
          prng.state = function() {
            return copy2(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xor4096 = impl;
      }
    })(
      exports,
      // window object or global
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/tychei.js
var require_tychei = __commonJS({
  "app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/tychei.js"(exports, module) {
    (function(global2, module2, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.next = function() {
          var b = me.b, c = me.c, d = me.d, a = me.a;
          b = b << 25 ^ b >>> 7 ^ c;
          c = c - d | 0;
          d = d << 24 ^ d >>> 8 ^ a;
          a = a - b | 0;
          me.b = b = b << 20 ^ b >>> 12 ^ c;
          me.c = c = c - d | 0;
          me.d = d << 16 ^ c >>> 16 ^ a;
          return me.a = a - b | 0;
        };
        me.a = 0;
        me.b = 0;
        me.c = 2654435769 | 0;
        me.d = 1367130551;
        if (seed === Math.floor(seed)) {
          me.a = seed / 4294967296 | 0;
          me.b = seed | 0;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 20; k++) {
          me.b ^= strseed.charCodeAt(k) | 0;
          me.next();
        }
      }
      function copy2(f, t3) {
        t3.a = f.a;
        t3.b = f.b;
        t3.c = f.c;
        t3.d = f.d;
        return t3;
      }
      ;
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy2(state, xg);
          prng.state = function() {
            return copy2(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.tychei = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// (disabled):crypto
var require_crypto = __commonJS({
  "(disabled):crypto"() {
  }
});

// app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/seedrandom.js
var require_seedrandom = __commonJS({
  "app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/seedrandom.js"(exports, module) {
    (function(global2, pool, math) {
      var width = 256, chunks = 6, digits = 52, rngname = "random", startdenom = math.pow(width, chunks), significance = math.pow(2, digits), overflow = significance * 2, mask = width - 1, nodecrypto;
      function seedrandom2(seed, options, callback) {
        var key = [];
        options = options == true ? { entropy: true } : options || {};
        var shortseed = mixkey(flatten(
          options.entropy ? [seed, tostring(pool)] : seed == null ? autoseed() : seed,
          3
        ), key);
        var arc4 = new ARC4(key);
        var prng = function() {
          var n = arc4.g(chunks), d = startdenom, x = 0;
          while (n < significance) {
            n = (n + x) * width;
            d *= width;
            x = arc4.g(1);
          }
          while (n >= overflow) {
            n /= 2;
            d /= 2;
            x >>>= 1;
          }
          return (n + x) / d;
        };
        prng.int32 = function() {
          return arc4.g(4) | 0;
        };
        prng.quick = function() {
          return arc4.g(4) / 4294967296;
        };
        prng.double = prng;
        mixkey(tostring(arc4.S), pool);
        return (options.pass || callback || function(prng2, seed2, is_math_call, state) {
          if (state) {
            if (state.S) {
              copy2(state, arc4);
            }
            prng2.state = function() {
              return copy2(arc4, {});
            };
          }
          if (is_math_call) {
            math[rngname] = prng2;
            return seed2;
          } else return prng2;
        })(
          prng,
          shortseed,
          "global" in options ? options.global : this == math,
          options.state
        );
      }
      function ARC4(key) {
        var t3, keylen = key.length, me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];
        if (!keylen) {
          key = [keylen++];
        }
        while (i < width) {
          s[i] = i++;
        }
        for (i = 0; i < width; i++) {
          s[i] = s[j = mask & j + key[i % keylen] + (t3 = s[i])];
          s[j] = t3;
        }
        (me.g = function(count) {
          var t4, r = 0, i2 = me.i, j2 = me.j, s2 = me.S;
          while (count--) {
            t4 = s2[i2 = mask & i2 + 1];
            r = r * width + s2[mask & (s2[i2] = s2[j2 = mask & j2 + t4]) + (s2[j2] = t4)];
          }
          me.i = i2;
          me.j = j2;
          return r;
        })(width);
      }
      function copy2(f, t3) {
        t3.i = f.i;
        t3.j = f.j;
        t3.S = f.S.slice();
        return t3;
      }
      ;
      function flatten(obj, depth) {
        var result = [], typ = typeof obj, prop;
        if (depth && typ == "object") {
          for (prop in obj) {
            try {
              result.push(flatten(obj[prop], depth - 1));
            } catch (e) {
            }
          }
        }
        return result.length ? result : typ == "string" ? obj : obj + "\0";
      }
      function mixkey(seed, key) {
        var stringseed = seed + "", smear, j = 0;
        while (j < stringseed.length) {
          key[mask & j] = mask & (smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++);
        }
        return tostring(key);
      }
      function autoseed() {
        try {
          var out;
          if (nodecrypto && (out = nodecrypto.randomBytes)) {
            out = out(width);
          } else {
            out = new Uint8Array(width);
            (global2.crypto || global2.msCrypto).getRandomValues(out);
          }
          return tostring(out);
        } catch (e) {
          var browser = global2.navigator, plugins = browser && browser.plugins;
          return [+/* @__PURE__ */ new Date(), global2, plugins, global2.screen, tostring(pool)];
        }
      }
      function tostring(a) {
        return String.fromCharCode.apply(0, a);
      }
      mixkey(math.random(), pool);
      if (typeof module == "object" && module.exports) {
        module.exports = seedrandom2;
        try {
          nodecrypto = require_crypto();
        } catch (ex) {
        }
      } else if (typeof define == "function" && define.amd) {
        define(function() {
          return seedrandom2;
        });
      } else {
        math["seed" + rngname] = seedrandom2;
      }
    })(
      // global: `self` in browsers (including strict mode and web workers),
      // otherwise `this` in Node and other environments
      typeof self !== "undefined" ? self : exports,
      [],
      // pool: entropy pool starts empty
      Math
      // math: package containing random, pow, and seedrandom
    );
  }
});

// app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/index.js
var require_seedrandom2 = __commonJS({
  "app/node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/index.js"(exports, module) {
    var alea = require_alea();
    var xor128 = require_xor128();
    var xorwow = require_xorwow();
    var xorshift7 = require_xorshift7();
    var xor4096 = require_xor4096();
    var tychei = require_tychei();
    var sr = require_seedrandom();
    sr.alea = alea;
    sr.xor128 = xor128;
    sr.xorwow = xorwow;
    sr.xorshift7 = xorshift7;
    sr.xor4096 = xor4096;
    sr.tychei = tychei;
    module.exports = sr;
  }
});

// app/node_modules/.pnpm/file-saver@2.0.5/node_modules/file-saver/dist/FileSaver.min.js
var require_FileSaver_min = __commonJS({
  "app/node_modules/.pnpm/file-saver@2.0.5/node_modules/file-saver/dist/FileSaver.min.js"(exports, module) {
    (function(a, b) {
      if ("function" == typeof define && define.amd) define([], b);
      else if ("undefined" != typeof exports) b();
      else {
        b(), a.FileSaver = { exports: {} }.exports;
      }
    })(exports, function() {
      "use strict";
      function b(a2, b2) {
        return "undefined" == typeof b2 ? b2 = { autoBom: false } : "object" != typeof b2 && (console.warn("Deprecated: Expected third argument to be a object"), b2 = { autoBom: !b2 }), b2.autoBom && /^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(a2.type) ? new Blob(["\uFEFF", a2], { type: a2.type }) : a2;
      }
      function c(a2, b2, c2) {
        var d2 = new XMLHttpRequest();
        d2.open("GET", a2), d2.responseType = "blob", d2.onload = function() {
          g(d2.response, b2, c2);
        }, d2.onerror = function() {
          console.error("could not download file");
        }, d2.send();
      }
      function d(a2) {
        var b2 = new XMLHttpRequest();
        b2.open("HEAD", a2, false);
        try {
          b2.send();
        } catch (a3) {
        }
        return 200 <= b2.status && 299 >= b2.status;
      }
      function e(a2) {
        try {
          a2.dispatchEvent(new MouseEvent("click"));
        } catch (c2) {
          var b2 = document.createEvent("MouseEvents");
          b2.initMouseEvent("click", true, true, window, 0, 0, 0, 80, 20, false, false, false, false, 0, null), a2.dispatchEvent(b2);
        }
      }
      var f = "object" == typeof window && window.window === window ? window : "object" == typeof self && self.self === self ? self : "object" == typeof global && global.global === global ? global : void 0, a = f.navigator && /Macintosh/.test(navigator.userAgent) && /AppleWebKit/.test(navigator.userAgent) && !/Safari/.test(navigator.userAgent), g = f.saveAs || ("object" != typeof window || window !== f ? function() {
      } : "download" in HTMLAnchorElement.prototype && !a ? function(b2, g2, h) {
        var i = f.URL || f.webkitURL, j = document.createElement("a");
        g2 = g2 || b2.name || "download", j.download = g2, j.rel = "noopener", "string" == typeof b2 ? (j.href = b2, j.origin === location.origin ? e(j) : d(j.href) ? c(b2, g2, h) : e(j, j.target = "_blank")) : (j.href = i.createObjectURL(b2), setTimeout(function() {
          i.revokeObjectURL(j.href);
        }, 4e4), setTimeout(function() {
          e(j);
        }, 0));
      } : "msSaveOrOpenBlob" in navigator ? function(f2, g2, h) {
        if (g2 = g2 || f2.name || "download", "string" != typeof f2) navigator.msSaveOrOpenBlob(b(f2, h), g2);
        else if (d(f2)) c(f2, g2, h);
        else {
          var i = document.createElement("a");
          i.href = f2, i.target = "_blank", setTimeout(function() {
            e(i);
          });
        }
      } : function(b2, d2, e2, g2) {
        if (g2 = g2 || open("", "_blank"), g2 && (g2.document.title = g2.document.body.innerText = "downloading..."), "string" == typeof b2) return c(b2, d2, e2);
        var h = "application/octet-stream" === b2.type, i = /constructor/i.test(f.HTMLElement) || f.safari, j = /CriOS\/[\d]+/.test(navigator.userAgent);
        if ((j || h && i || a) && "undefined" != typeof FileReader) {
          var k = new FileReader();
          k.onloadend = function() {
            var a2 = k.result;
            a2 = j ? a2 : a2.replace(/^data:[^;]*;/, "data:attachment/file;"), g2 ? g2.location.href = a2 : location = a2, g2 = null;
          }, k.readAsDataURL(b2);
        } else {
          var l = f.URL || f.webkitURL, m = l.createObjectURL(b2);
          g2 ? g2.location = m : location.href = m, g2 = null, setTimeout(function() {
            l.revokeObjectURL(m);
          }, 4e4);
        }
      });
      f.saveAs = g.saveAs = g, "undefined" != typeof module && (module.exports = g);
    });
  }
});

// app/notices/ray-optics/source/Scene.js
init_sceneObjs();

// app/notices/ray-optics/source/versionUpdate.js
init_sceneObjs();
var scene_update = {
  "rayDensity_light": "rayModeDensity",
  "rayDensity_images": "imageModeDensity",
  "grid": "snapToGrid",
  "lockobjs": "lockObjs",
  "colorMode": "simulateColors",
  "symbolicGrin": "symbolicBodyMerging"
};
var mode_update = {
  "light": "rays",
  "extended_light": "extended"
};
var obj_update = {
  "laser": {
    "type": "SingleRay",
    "p": "brightness"
  },
  "parallel": {
    "type": "Beam",
    "p": "brightness",
    "divergence": "emisAngle"
  },
  "radiant": {
    "type": "PointSource",
    "p": "brightness"
  },
  "led": {
    "type": "AngleSource",
    "p": "emisAngle"
  },
  "mirror": {
    "type": "Mirror",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "arcmirror": {
    "type": "ArcMirror",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "parabolicmirror": {
    "type": "ParabolicMirror",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "curvedmirror": {
    "type": "CustomMirror",
    "p": "eqn",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "idealmirror": {
    "type": "IdealMirror",
    "p": "focalLength",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "beamsplitter": {
    "type": "BeamSplitter",
    "p": "transRatio",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "halfplane": {
    "type": "PlaneGlass",
    "p": "refIndex",
    "cauchyCoeff": "cauchyB"
  },
  "circlelens": {
    "type": "CircleGlass",
    "p": "refIndex",
    "cauchyCoeff": "cauchyB"
  },
  "refractor": {
    "type": "Glass",
    "p": "refIndex",
    "cauchyCoeff": "cauchyB"
  },
  "curvedglass": {
    "type": "CustomGlass",
    "p": "refIndex",
    "cauchyCoeff": "cauchyB"
  },
  "lens": {
    "type": "IdealLens",
    "p": "focalLength"
  },
  "sphericallens": {
    "type": "SphericalLens",
    "p": "refIndex",
    "cauchyCoeff": "cauchyB",
    "definedBy": "defBy"
  },
  "grin_circlelens": {
    "type": "CircleGrinGlass",
    "p_tex": "refIndexFn",
    "step_size": "stepSize",
    "eps": "intersectTol"
  },
  "grin_refractor": {
    "type": "GrinGlass",
    "p_tex": "refIndexFn",
    "step_size": "stepSize",
    "eps": "intersectTol"
  },
  "blackline": {
    "type": "Blocker",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "blackcircle": {
    "type": "CircleBlocker",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "aperture": {
    "type": "Aperture",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "diffractiongrating": {
    "type": "DiffractionGrating",
    "line_density": "lineDensity",
    "slit_ratio": "slitRatio"
  },
  "ruler": {
    "type": "Ruler",
    "p": "scaleInterval"
  },
  "protractor": {
    "type": "Protractor"
  },
  "power": {
    "type": "Detector",
    "irradianceMap": "irradMap"
  },
  "text": {
    "type": "TextLabel",
    "p": "text",
    "fontName": "font",
    "fontAlignment": "alignment",
    "fontSmallCaps": "smallCaps",
    "fontAngle": "angle"
  },
  "line": {
    "type": "LineArrow",
    "arrow1": "arrow",
    "arrow2": "backArrow"
  },
  "drawing": {
    "type": "Drawing",
    "points": "strokes"
  },
  "handle": {
    "type": "Handle"
  },
  "cropbox": {
    "type": "CropBox"
  }
};
function versionUpdate(jsonData) {
  if (!jsonData.version) {
    let str1 = JSON.stringify(jsonData).replace(/"point"|"xxa"|"aH"/g, "1").replace(/"circle"|"xxf"/g, "5").replace(/"k"/g, '"objs"').replace(/"L"/g, '"p1"').replace(/"G"/g, '"p2"').replace(/"F"/g, '"p3"').replace(/"bA"/g, '"exist"').replace(/"aa"/g, '"parallel"').replace(/"ba"/g, '"mirror"').replace(/"bv"/g, '"lens"').replace(/"av"/g, '"notDone"').replace(/"bP"/g, '"lightAlpha"').replace(/"ab"|"observed_light"|"observed_images"/g, '"observer"');
    jsonData = JSON.parse(str1);
    if (!jsonData.objs) {
      jsonData = { objs: jsonData };
    }
    if (!jsonData.mode) {
      jsonData.mode = "light";
    }
    if (!jsonData.rayDensity_light) {
      jsonData.rayDensity_light = 1;
    }
    if (!jsonData.rayDensity_images) {
      jsonData.rayDensity_images = 1;
    }
    if (!jsonData.scale) {
      jsonData.scale = 1;
    }
    jsonData.version = 1;
  }
  if (jsonData.version == 1) {
    jsonData.origin = { x: 0, y: 0 };
    jsonData.version = 2;
  }
  if (jsonData.version == 2) {
    let updateProperties2 = function(obj) {
      if (typeof obj === "object" && obj !== null) {
        if (obj.exist !== void 0) {
          delete obj.exist;
        }
        if (typeof obj.type === "number") {
          delete obj.type;
        }
        if (obj.byHandle !== void 0) {
          delete obj.byHandle;
        }
        if (obj.targetObj_index !== void 0) {
          obj.targetObjIndex = obj.targetObj_index;
          delete obj.targetObj_index;
        }
        if (obj.mousePart !== void 0) {
          obj.dragContext = obj.mousePart;
          delete obj.mousePart;
        }
        for (let key in obj) {
          updateProperties2(obj[key]);
        }
      }
    };
    var updateProperties = updateProperties2;
    for (let key in scene_update) {
      if (jsonData[key] !== void 0) {
        jsonData[scene_update[key]] = jsonData[key];
        delete jsonData[key];
      }
    }
    if (jsonData.mode in mode_update) {
      jsonData.mode = mode_update[jsonData.mode];
    }
    jsonData.objs = jsonData.objs.map((objData) => {
      if (objData.type in obj_update) {
        for (let key in obj_update[objData.type]) {
          if (key !== "type" && objData[key] !== void 0) {
            objData[obj_update[objData.type][key]] = objData[key];
            delete objData[key];
          }
        }
        objData.type = obj_update[objData.type].type;
      }
      return objData;
    });
    updateProperties2(jsonData);
    const knownKeys = ["version", "name", "objs", "backgroundImage", ...Object.keys(Scene_default.serializableDefaults)];
    for (let key in jsonData) {
      if (!knownKeys.includes(key)) {
        delete jsonData[key];
      }
    }
    jsonData.objs = jsonData.objs.filter((objData) => {
      return objData.type in sceneObjs_exports;
    });
    jsonData.objs = jsonData.objs.map((objData) => {
      const knownKeys2 = ["type", ...Object.keys(sceneObjs_exports[objData.type].serializableDefaults)];
      for (let key in objData) {
        if (!knownKeys2.includes(key)) {
          delete objData[key];
        }
      }
      return objData;
    });
    jsonData.version = 5;
  }
  return jsonData;
}

// app/notices/ray-optics/source/Scene.js
init_i18next();
var import_seedrandom = __toESM(require_seedrandom2(), 1);
var DATA_VERSION = 5;
function mergeWithDefaults(target, source, defaults, path = "") {
  const result = JSON.parse(JSON.stringify(defaults));
  if (source && typeof source === "object" && !Array.isArray(source)) {
    for (const key in source) {
      if (key in defaults) {
        if (typeof defaults[key] === "object" && !Array.isArray(defaults[key]) && defaults[key] !== null) {
          result[key] = mergeWithDefaults(result[key], source[key], defaults[key], path ? `${path}.${key}` : key);
        } else {
          result[key] = source[key];
        }
      }
    }
  }
  return result;
}
function validateNestedKeys(obj, defaults, path = "") {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return null;
  }
  for (const key in obj) {
    const currentPath = path ? `${path}.${key}` : key;
    if (!(key in defaults)) {
      return currentPath;
    }
    if (typeof defaults[key] === "object" && !Array.isArray(defaults[key]) && defaults[key] !== null) {
      const nestedError = validateNestedKeys(obj[key], defaults[key], currentPath);
      if (nestedError) {
        return nestedError;
      }
    }
  }
  return null;
}
function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return obj1 === obj2;
  if (typeof obj1 !== typeof obj2) return false;
  if (typeof obj1 !== "object") return obj1 === obj2;
  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (!(key in obj2)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  return true;
}
function extractNonDefaults(obj, defaults) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return deepEqual(obj, defaults) ? null : obj;
  }
  const result = {};
  let hasNonDefaults = false;
  for (const key in obj) {
    if (key in defaults) {
      if (typeof defaults[key] === "object" && !Array.isArray(defaults[key]) && defaults[key] !== null) {
        const nested = extractNonDefaults(obj[key], defaults[key]);
        if (nested !== null) {
          result[key] = nested;
          hasNonDefaults = true;
        }
      } else {
        if (!deepEqual(obj[key], defaults[key])) {
          result[key] = obj[key];
          hasNonDefaults = true;
        }
      }
    }
  }
  return hasNonDefaults ? result : null;
}
var Scene = class _Scene {
  static serializableDefaults = {
    name: "",
    importedFromBeta: false,
    modules: {},
    objs: [],
    mode: "rays",
    rayModeDensity: 0.1,
    imageModeDensity: 1,
    showGrid: false,
    snapToGrid: false,
    lockObjs: false,
    gridSize: 20,
    observer: null,
    lengthScale: 1,
    origin: { x: 0, y: 0 },
    scale: 1,
    width: 1500,
    height: 900,
    simulateColors: false,
    redWavelength: 620,
    violetWavelength: 420,
    keepNonVisibleLight: false,
    colorMode: "default",
    showRayArrows: false,
    symbolicBodyMerging: false,
    rayPowerCutoff: 1e-6,
    rayPowerSampling: false,
    maxRayDepth: Infinity,
    randomSeed: null,
    theme: {
      background: {
        color: { r: 0, g: 0, b: 0 }
      },
      ray: {
        color: { r: 1, g: 1, b: 0.5 },
        dash: []
      },
      colorRay: {
        dash: []
      },
      extendedRay: {
        color: { r: 1, g: 0.5, b: 0 },
        dash: []
      },
      colorExtendedRay: {
        dash: [2, 2]
      },
      forwardExtendedRay: {
        color: { r: 0.3, g: 0.3, b: 0.3 },
        dash: []
      },
      colorForwardExtendedRay: {
        dash: [1, 5]
      },
      observedRay: {
        color: { r: 0, g: 0, b: 1 },
        dash: []
      },
      colorObservedRay: {
        dash: [1, 2]
      },
      realImage: {
        color: { r: 1, g: 1, b: 0.5 },
        size: 5
      },
      colorRealImage: {
        size: 5
      },
      virtualImage: {
        color: { r: 1, g: 0.5, b: 0 },
        size: 5
      },
      colorVirtualImage: {
        size: 3
      },
      virtualObject: {
        color: { r: 0.3, g: 0.3, b: 0.3 },
        size: 5
      },
      colorVirtualObject: {
        size: 1
      },
      grid: {
        color: { r: 1, g: 1, b: 1, a: 0.25 },
        dash: [2, 2],
        width: 1
      },
      observer: {
        color: { r: 0, g: 0, b: 1 }
      },
      sourcePoint: {
        color: { r: 1, g: 0, b: 0, a: 1 },
        size: 5
      },
      directionPoint: {
        color: { r: 1, g: 0, b: 0, a: 1 },
        size: 3
      },
      centerPoint: {
        color: { r: 1, g: 0, b: 0, a: 1 },
        size: 3
      },
      lightSource: {
        color: { r: 0, g: 1, b: 0, a: 1 },
        size: 5
      },
      beamShield: {
        color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
        width: 2
      },
      colorSourceCenter: {
        color: { r: 1, g: 1, b: 1, a: 1 },
        size: 3
      },
      mirror: {
        color: { r: 0.66, g: 0.66, b: 0.66, a: 1 },
        width: 1
      },
      beamSplitter: {
        color: { r: 0.39, g: 0.39, b: 0.66, a: 1 },
        width: 1
      },
      idealCurveCenter: {
        color: { r: 1, g: 1, b: 1, a: 1 },
        size: 1
      },
      idealCurveArrow: {
        color: { r: 1, g: 0, b: 0, a: 1 },
        size: 10
      },
      glass: {
        color: { r: 1, g: 1, b: 1 }
      },
      glassAbsorption: {
        color: { r: 1, g: 0.41, b: 0 }
      },
      grinGlass: {
        color: { r: 1, g: 0, b: 1, a: 0.15 }
      },
      blocker: {
        color: { r: 0.29, g: 0.14, b: 0.04, a: 1 },
        width: 3
      },
      diffractionGrating: {
        color: { r: 0.49, g: 0.24, b: 0.07, a: 1 },
        dash: [2, 2],
        width: 2
      },
      detector: {
        color: { r: 0.66, g: 0.66, b: 0.66, a: 1 },
        dash: [5, 5],
        width: 1
      },
      detectorText: {
        color: { r: 0.66, g: 0.66, b: 0.66, a: 1 },
        font: "Arial",
        size: 16
      },
      irradMap: {
        color: { r: 0, g: 0, b: 1, a: 1 }
      },
      irradMapBorder: {
        color: { r: 1, g: 1, b: 1, a: 1 },
        width: 1
      },
      ruler: {
        color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
        width: 1
      },
      rulerText: {
        color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
        font: "Arial",
        size: 14
      },
      decoration: {
        color: { r: 1, g: 1, b: 1, a: 1 },
        width: 1
      },
      handlePoint: {
        color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }
      },
      handleArrow: {
        color: { r: 1, g: 1, b: 1, a: 1 },
        size: 24
      },
      customSurface: {
        color: { r: 0.73, g: 0.58, b: 1, a: 1 },
        width: 2,
        dash: [2, 2]
      }
    }
  };
  static nestedProperties = ["theme"];
  constructor() {
    this.backgroundImage = null;
    this.error = null;
    this.warning = null;
    this.rng = new import_seedrandom.default((/* @__PURE__ */ new Date()).getTime().toString());
    this.loadJSON(JSON.stringify({ version: DATA_VERSION }), () => {
    });
  }
  /**
  * Set the size (in CSS pixels) for the viewport of the scene.
  * @method setViewportSize
  * @param {number} width
  * @param {number} height
  */
  setViewportSize(width, height) {
    this.width = width;
    this.height = height;
  }
  /** @property {number} rayDensity - The mode-dependent ray density. */
  get rayDensity() {
    return this.mode == "rays" || this.mode == "extended" ? this.rayModeDensity : this.imageModeDensity;
  }
  set rayDensity(val) {
    if (this.mode == "rays" || this.mode == "extended") {
      this.rayModeDensity = val;
    } else {
      this.imageModeDensity = val;
    }
  }
  /** @property {boolean} isBackgroundLight - Whether the background is light (as opposed to dark). */
  get isBackgroundLight() {
    const bgColor = this.theme.background.color;
    const luminance = 0.299 * bgColor.r + 0.587 * bgColor.g + 0.114 * bgColor.b;
    return luminance > 0.5;
  }
  /** @property {string} highlightColor - The color used to highlight hovered objects in the scene. */
  get highlightColor() {
    if (this.isBackgroundLight) {
      return { r: 0, g: 0.75, b: 0.75, a: 1 };
    } else {
      return { r: 0, g: 1, b: 1, a: 1 };
    }
  }
  /** @property {string} highlightColorCss - The CSS color string used to highlight hovered objects in the scene. */
  get highlightColorCss() {
    if (this.isBackgroundLight) {
      return "rgb(0, 192, 192)";
    } else {
      return "rgb(0, 255, 255)";
    }
  }
  /** @property {Array<BaseSceneObj>} opticalObjs - The objects in the scene which are optical. Module objects are expanded recursively. If the user edits only the non-optical part of the scene, then the content of this array will not change. */
  get opticalObjs() {
    function expandObjs(objs) {
      let expandedObjs = [];
      for (let obj of objs) {
        if (obj.constructor.type === "ModuleObj") {
          expandedObjs = expandedObjs.concat(expandObjs(obj.objs));
        } else {
          expandedObjs.push(obj);
        }
      }
      return expandedObjs;
    }
    return expandObjs(this.objs).filter((obj) => obj.constructor.isOptical);
  }
  /**
   * The callback function when the entire scene or a resource (e.g. image) is loaded.
   * @callback loadJSONCallback
   * @param {boolean} needFullUpdate - Whether the scene needs a full update.
   * @param {boolean} completed - Whether the scene is completely loaded.
   */
  /**
  * Load the scene from JSON.
  * @param {string} json
  * @param {loadJSONCallback} callback - The callback function when the entire scene or a resource (e.g. image) is loaded.
  */
  loadJSON(json, callback) {
    this.error = null;
    this.warning = null;
    try {
      let jsonData = JSON.parse(json);
      if (!jsonData.version) {
        jsonData = versionUpdate(jsonData);
      } else if (typeof jsonData.version === "string" || jsonData.version > DATA_VERSION) {
        this.error = instance.t("simulator:generalErrors.newerVersion");
        callback(true, true);
        return;
      } else if (jsonData.version < DATA_VERSION) {
        jsonData = versionUpdate(jsonData);
      }
      const serializableDefaults = _Scene.serializableDefaults;
      const originalWidth = this.width || serializableDefaults.width;
      const originalHeight = this.height || serializableDefaults.height;
      const approximatedWidth = Math.ceil(originalWidth / 100) * 100;
      const approximatedHeight = Math.ceil(originalHeight / 100) * 100;
      const knownKeys = ["version", "name", "modules", "objs", "backgroundImage", ...Object.keys(serializableDefaults)];
      for (const key in jsonData) {
        if (!knownKeys.includes(key)) {
          this.error = instance.t("simulator:generalErrors.unknownSceneKey", { key });
          callback(true, true);
          return;
        }
      }
      for (const nestedProp of _Scene.nestedProperties) {
        if (jsonData[nestedProp]) {
          const unknownKey = validateNestedKeys(jsonData[nestedProp], serializableDefaults[nestedProp], nestedProp);
          if (unknownKey) {
            this.error = instance.t("simulator:generalErrors.unknownSceneKey", { key: unknownKey });
            callback(true, true);
            return;
          }
        }
      }
      const validModes = ["rays", "extended", "images", "observer"];
      if (jsonData.mode && !validModes.includes(jsonData.mode)) {
        this.error = instance.t("simulator:generalErrors.unknownPropertyValue", { property: "mode", value: jsonData.mode });
        callback(true, true);
        return;
      }
      const validColorModes = ["default", "linear", "linearRGB", "reinhard", "colorizedIntensity"];
      if (jsonData.colorMode && !validColorModes.includes(jsonData.colorMode)) {
        this.error = instance.t("simulator:generalErrors.unknownPropertyValue", { property: "colorMode", value: jsonData.colorMode });
        callback(true, true);
        return;
      }
      for (let key in serializableDefaults) {
        if (!(key in jsonData)) {
          jsonData[key] = JSON.parse(JSON.stringify(serializableDefaults[key]));
        }
        if (_Scene.nestedProperties.includes(key)) {
          this[key] = mergeWithDefaults(null, jsonData[key], serializableDefaults[key]);
        } else {
          this[key] = jsonData[key];
        }
      }
      let rescaleFactor = 1;
      if (jsonData.width / jsonData.height > approximatedWidth / approximatedHeight) {
        rescaleFactor = jsonData.width / approximatedWidth;
      } else {
        rescaleFactor = jsonData.height / approximatedHeight;
      }
      this.scale = jsonData.scale / rescaleFactor;
      this.origin.x = jsonData.origin.x / rescaleFactor;
      this.origin.y = jsonData.origin.y / rescaleFactor;
      this.width = originalWidth;
      this.height = originalHeight;
      if (this.randomSeed) {
        this.rng = new import_seedrandom.default(this.randomSeed);
      } else {
        this.rng = new import_seedrandom.default((/* @__PURE__ */ new Date()).getTime().toString());
      }
      this.objs = [];
      for (const objData of jsonData.objs) {
        if (!sceneObjs_exports[objData.type]) {
          this.error = instance.t("simulator:generalErrors.unknownObjectType", { type: objData.type });
          break;
        }
        this.objs.push(new sceneObjs_exports[objData.type](this, objData));
      }
      if (this.error) {
        callback(true, true);
        return;
      }
      if (jsonData.backgroundImage) {
        this.backgroundImage = new Image();
        this.backgroundImage.src = "../gallery/" + jsonData.backgroundImage;
        this.backgroundImage.onload = function(e1) {
          callback(false, true);
        };
        callback(true, false);
      } else {
        callback(true, true);
      }
    } catch (e) {
      this.error = e.toString();
      this.objs = [];
      callback(true, true);
    }
  }
  /**
   * Convert the scene to JSON.
   * @method toJSON
   * @returns {string} The JSON string representing the scene.
   */
  toJSON() {
    let jsonData = { version: DATA_VERSION };
    if (this.name) {
      jsonData.name = this.name;
    }
    if (this.importedFromBeta) {
      jsonData.importedFromBeta = true;
    }
    if (Object.keys(this.modules).length > 0) {
      jsonData.modules = this.modules;
    }
    jsonData.objs = this.objs.map((obj) => obj.serialize());
    const approximatedWidth = Math.ceil(this.width / 100) * 100;
    const approximatedHeight = Math.ceil(this.height / 100) * 100;
    jsonData.width = approximatedWidth;
    jsonData.height = approximatedHeight;
    const serializableDefaults = _Scene.serializableDefaults;
    for (let propName in serializableDefaults) {
      if (!jsonData.hasOwnProperty(propName)) {
        if (_Scene.nestedProperties.includes(propName)) {
          const nonDefaults = extractNonDefaults(this[propName], serializableDefaults[propName]);
          if (nonDefaults !== null) {
            jsonData[propName] = nonDefaults;
          }
        } else {
          const stringifiedValue = JSON.stringify(this[propName]);
          const stringifiedDefault = JSON.stringify(serializableDefaults[propName]);
          if (stringifiedValue !== stringifiedDefault) {
            jsonData[propName] = JSON.parse(stringifiedValue);
          }
        }
      }
    }
    return JSON.stringify(jsonData, null, 2);
  }
  /**
   * Add an object to the scene.
   * @param {BaseSceneObj} obj
   */
  pushObj(obj) {
    this.objs.push(obj);
    obj.scene = this;
  }
  /**
   * Add an object to the scene at the beginning of the list.
   * @param {BaseSceneObj} obj
   */
  unshiftObj(obj) {
    this.objs.unshift(obj);
    obj.scene = this;
    for (var i in this.objs) {
      if (this.objs[i].constructor.type == "Handle") {
        for (var j in this.objs[i].controlPoints) {
          this.objs[i].controlPoints[j].targetObjIndex++;
        }
        for (var j in this.objs[i].objIndices) {
          this.objs[i].objIndices[j]++;
        }
      }
    }
  }
  /**
   * Remove the object at an index.
   * @param {number} index
   */
  removeObj(index) {
    for (var i = index; i < this.objs.length - 1; i++) {
      let oldObj = this.objs[i + 1].serialize();
      this.objs[i] = new sceneObjs_exports[oldObj.type](this, oldObj);
    }
    for (var i in this.objs) {
      if (this.objs[i].constructor.type == "Handle") {
        let newControlPoints = [];
        for (var j = 0; j < this.objs[i].controlPoints.length; j++) {
          if (this.objs[i].controlPoints[j].targetObjIndex > index) {
            this.objs[i].controlPoints[j].targetObjIndex--;
            newControlPoints.push(this.objs[i].controlPoints[j]);
          } else if (this.objs[i].controlPoints[j].targetObjIndex != index) {
            newControlPoints.push(this.objs[i].controlPoints[j]);
          }
        }
        this.objs[i].controlPoints = newControlPoints;
        let newObjIndices = [];
        for (var j = 0; j < this.objs[i].objIndices.length; j++) {
          if (this.objs[i].objIndices[j] > index) {
            newObjIndices.push(this.objs[i].objIndices[j] - 1);
          } else if (this.objs[i].objIndices[j] != index) {
            newObjIndices.push(this.objs[i].objIndices[j]);
          }
        }
        this.objs[i].objIndices = newObjIndices;
      }
    }
    this.objs.length = this.objs.length - 1;
  }
  /**
   * Reorder an object in the scene.
   * @param {number} fromIndex - The original index.
   * @param {number} toIndex - The destination index.
   */
  reorderObj(fromIndex, toIndex) {
    if (fromIndex === toIndex) {
      return;
    }
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= this.objs.length || toIndex >= this.objs.length) {
      return;
    }
    const moved = this.objs.splice(fromIndex, 1)[0];
    this.objs.splice(toIndex, 0, moved);
    const remapIndex = (oldIndex) => {
      if (oldIndex === fromIndex) {
        return toIndex;
      }
      if (fromIndex < toIndex) {
        if (oldIndex > fromIndex && oldIndex <= toIndex) {
          return oldIndex - 1;
        }
      } else {
        if (oldIndex >= toIndex && oldIndex < fromIndex) {
          return oldIndex + 1;
        }
      }
      return oldIndex;
    };
    for (let i = 0; i < this.objs.length; i++) {
      if (this.objs[i].constructor.type === "Handle") {
        const handle = this.objs[i];
        if (Array.isArray(handle.controlPoints)) {
          for (let j = 0; j < handle.controlPoints.length; j++) {
            if (typeof handle.controlPoints[j].targetObjIndex === "number") {
              handle.controlPoints[j].targetObjIndex = remapIndex(handle.controlPoints[j].targetObjIndex);
            }
          }
        }
        if (Array.isArray(handle.objIndices)) {
          handle.objIndices = handle.objIndices.map(remapIndex);
        }
      }
    }
  }
  /**
   * Clone the object at an index.
   * @param {number} index
   * @returns {BaseSceneObj} The cloned object
   */
  cloneObj(index) {
    let oldObj = this.objs[index].serialize();
    this.objs[this.objs.length] = new sceneObjs_exports[oldObj.type](this, oldObj);
    return this.objs[this.objs.length - 1];
  }
  /**
   * Clone the objects bound to the handle at an index.
   * @param {number} index
   */
  cloneObjsByHandle(index) {
    let handle = this.objs[index];
    if (handle.constructor.type !== "Handle") {
      return;
    }
    var indices = [];
    for (var j in handle.controlPoints) {
      if (indices.indexOf(handle.controlPoints[j].targetObjIndex) == -1) {
        indices.push(handle.controlPoints[j].targetObjIndex);
      }
    }
    for (var j in handle.objIndices) {
      if (indices.indexOf(handle.objIndices[j]) == -1) {
        indices.push(handle.objIndices[j]);
      }
    }
    for (var j in indices) {
      if (this.objs[indices[j]].constructor.type != "Handle") {
        this.cloneObj(indices[j]);
      }
    }
  }
  /**
   * Add a module definition.
   * @param {string} moduleName
   * @param {ModuleDef} moduleDef
   * @returns {boolean} Whether the module is successfully added.
   */
  addModule(moduleName, moduleDef) {
    this.modules[moduleName] = moduleDef;
    for (let i in this.objs) {
      if (this.objs[i].constructor.type === "ModuleObj") {
        this.objs[i] = new (void 0)(this, this.objs[i].serialize());
      }
    }
    return true;
  }
  /**
   * Reload a module definition and re-expand its objects.
   * ModuleObj holds a reference to this.modules[moduleName], so after the definition
   * is updated, we just call expandObjs() to regenerate expanded objs (no serialize).
   * Also handles nested instances (e.g. Module A containing Module B when B is reloaded).
   * @param {string} moduleName
   */
  reloadModule(moduleName) {
    if (!this.modules[moduleName]) {
      return;
    }
    const reloadInObjs = (objs) => {
      if (!Array.isArray(objs)) return;
      for (const obj of objs) {
        if (obj?.constructor?.type !== "ModuleObj") continue;
        if (obj.module === moduleName) {
          obj.expandObjs();
        } else {
          reloadInObjs(obj.objs);
        }
      }
    };
    reloadInObjs(this.objs);
  }
  /**
   * Reload all module objects in the scene.
   */
  reloadAllModules() {
    for (let i = 0; i < this.objs.length; i++) {
      const obj = this.objs[i];
      if (obj.constructor.type === "ModuleObj") {
        this.objs[i] = new (void 0)(this, obj.serialize());
      }
    }
  }
  /**
   * ModuleObj refs for a module name: each {@link sceneObjs.ModuleObj} at top level of {@link Scene#objs},
   * and each module instance template (`type: 'ModuleObj'`) at top level of every {@link ModuleDef#objs}.
   * Live references only; not expanded objects inside module instances.
   *
   * @param {string} moduleId - The module name (`ModuleObj#module`), same as keys of {@link Scene#modules}.
   * @returns {Array<sceneObjs.ModuleObj|Object>} Scene instances, then definition templates (serialized-shape plain objects).
   */
  getModuleObjRefsById(moduleId) {
    const moduleObjRefs = [];
    for (const obj of this.objs) {
      if (obj?.constructor?.type === "ModuleObj" && obj.module === moduleId) {
        moduleObjRefs.push(obj);
      }
    }
    for (const moduleDef of Object.values(this.modules)) {
      if (!moduleDef || !Array.isArray(moduleDef.objs)) continue;
      for (const obj of moduleDef.objs) {
        if (obj && typeof obj === "object" && obj.type === "ModuleObj" && obj.module === moduleId) {
          moduleObjRefs.push(obj);
        }
      }
    }
    return moduleObjRefs;
  }
  /**
   * Move objects into a module definition.
   * @param {number[]} indices
   * @param {string} moduleName
   * @returns {{ moved: number, skipped: number }}
   */
  moveObjsToModule(indices, moduleName) {
    if (!Array.isArray(indices) || !this.modules[moduleName]) {
      return { moved: 0, skipped: 0 };
    }
    const unique = Array.from(new Set(indices.filter(Number.isInteger))).sort((a, b) => b - a);
    const moduleDef = this.modules[moduleName];
    if (!Array.isArray(moduleDef.objs)) {
      moduleDef.objs = [];
    }
    const movedObjs = [];
    let skipped = 0;
    for (const index of unique) {
      const obj = this.objs[index];
      if (!obj) {
        continue;
      }
      if (obj.constructor.type === "Handle") {
        skipped += 1;
        continue;
      }
      movedObjs.unshift(obj.serialize());
      this.removeObj(index);
    }
    if (movedObjs.length > 0) {
      moduleDef.objs.push(...movedObjs);
      this.reloadAllModules();
    }
    return { moved: movedObjs.length, skipped };
  }
  /**
   * Convert a handle into a new module: one control point at the handle position, bound scene objects
   * moved into the module definition, the handle removed, and a new {@link sceneObjs.ModuleObj} added.
   * @param {number} handleIndex - Index of the {@link sceneObjs.Handle} in {@link Scene#objs}.
   * @param {string} moduleName - Name for the new module (must not already exist).
   * @returns {{ok: boolean, moduleObjIndex: (number|undefined)}}
   */
  convertHandleToModule(handleIndex, moduleName) {
    if (!Number.isInteger(handleIndex) || handleIndex < 0 || handleIndex >= this.objs.length) {
      return { ok: false };
    }
    if (this.modules[moduleName]) {
      return { ok: false };
    }
    const handle = this.objs[handleIndex];
    if (!handle || handle.constructor.type !== "Handle") {
      return { ok: false };
    }
    const p1 = { x: handle.p1.x, y: handle.p1.y };
    const indicesSet = /* @__PURE__ */ new Set();
    for (const idx of handle.objIndices || []) {
      if (Number.isInteger(idx) && idx >= 0 && idx !== handleIndex) {
        indicesSet.add(idx);
      }
    }
    for (const cp of handle.controlPoints || []) {
      const idx = cp.targetObjIndex;
      if (Number.isInteger(idx) && idx >= 0 && idx !== handleIndex) {
        indicesSet.add(idx);
      }
    }
    this.modules[moduleName] = {
      numPoints: 1,
      params: [],
      vars: [],
      objs: []
    };
    const indices = Array.from(indicesSet).sort((a, b) => b - a);
    this.moveObjsToModule(indices, moduleName);
    const hi = this.objs.indexOf(handle);
    if (hi < 0) {
      return { ok: false };
    }
    this.removeObj(hi);
    const moduleObjJson = {
      type: "ModuleObj",
      module: moduleName,
      points: [{ x: p1.x, y: p1.y }],
      params: {}
    };
    this.objs.push(new (void 0)(this, moduleObjJson));
    const moduleObjIndex = this.objs.length - 1;
    this.reloadAllModules();
    return { ok: true, moduleObjIndex };
  }
  /**
   * Move module definition objects out into the scene.
   * @param {string} moduleName
   * @param {number[]} sourceIndices
   * @returns {{ moved: number }}
   */
  moveModuleObjsToScene(moduleName, sourceIndices) {
    if (!this.modules[moduleName] || !Array.isArray(sourceIndices)) {
      return { moved: 0 };
    }
    const moduleDef = this.modules[moduleName];
    const unique = Array.from(new Set(sourceIndices.filter(Number.isInteger))).sort((a, b) => a - b);
    const sourceSet = new Set(unique);
    if (!Array.isArray(moduleDef.objs)) {
      moduleDef.objs = [];
    }
    const movedObjs = [];
    moduleDef.objs = moduleDef.objs.filter((obj, index) => {
      if (sourceSet.has(index)) {
        movedObjs.push(obj);
        return false;
      }
      return true;
    });
    if (!movedObjs.length) {
      return { moved: 0 };
    }
    const appendExpanded = (moduleObj) => {
      if (!moduleObj?.objs) return;
      for (const obj of moduleObj.objs) {
        if (obj?.constructor?.type === "ModuleObj") {
          appendExpanded(obj);
        } else if (Number.isInteger(obj?._moduleSourceIndex) && sourceSet.has(obj._moduleSourceIndex)) {
          const serialized = obj.serialize();
          const newObj = new sceneObjs_exports[serialized.type](this, serialized);
          this.objs.push(newObj);
        }
      }
    };
    const walkModuleInstances = (obj) => {
      if (!obj) return;
      if (obj.constructor?.type === "ModuleObj") {
        if (obj.module === moduleName) {
          appendExpanded(obj);
        }
        if (Array.isArray(obj.objs)) {
          for (const child of obj.objs) {
            walkModuleInstances(child);
          }
        }
      }
    };
    for (const obj of this.objs) {
      walkModuleInstances(obj);
    }
    this.reloadAllModules();
    return { moved: movedObjs.length };
  }
  /**
   * Remove a given module and demodulize all corresponding module objects.
   * @param {string} moduleName 
   */
  removeModule(moduleName) {
    mainLoop: while (true) {
      for (let obj of this.objs) {
        if (obj.constructor.type === "ModuleObj" && obj.module === moduleName) {
          obj.demodulize();
          continue mainLoop;
        }
      }
      break;
    }
    delete this.modules[moduleName];
  }
  /**
   * Rename a module.
   * @param {string} oldName - The old name of the module.
   * @param {string} newName - The new name of the module.
   * @returns {boolean} Whether the module is successfully renamed.
   */
  renameModule(oldName, newName) {
    if (oldName === newName) {
      return false;
    }
    if (!this.modules[oldName]) {
      return false;
    }
    if (this.modules[newName]) {
      return false;
    }
    this.modules[newName] = this.modules[oldName];
    delete this.modules[oldName];
    for (let obj of this.objs) {
      if (obj.constructor.type === "ModuleObj" && obj.module === oldName) {
        obj.module = newName;
      }
    }
    for (let moduleDef of Object.values(this.modules)) {
      if (!moduleDef || !Array.isArray(moduleDef.objs)) continue;
      for (let obj of moduleDef.objs) {
        if (obj.type === "ModuleObj" && obj.module === oldName) {
          obj.module = newName;
        }
      }
    }
    this.reloadAllModules();
    return true;
  }
  /**
   * Create a blank module and add a blank instance of it to the scene.
   * @param {string} moduleName - The name of the module.
   * @returns {boolean} Whether the module is successfully created.
   */
  createModule(moduleName) {
    if (this.modules[moduleName]) {
      return false;
    }
    this.modules[moduleName] = {
      numPoints: 0,
      params: [],
      vars: [],
      objs: []
    };
    this.objs.push(new (void 0)(this, { module: moduleName }));
    return true;
  }
  /**
   * Set the scale of the scene while keeping a given center point fixed.
   * @param {number} value - The new scale factor.
   * @param {number} centerX - The x-coordinate of the center point.
   * @param {number} centerY - The y-coordinate of the center point.
   */
  setScaleWithCenter(value, centerX, centerY) {
    const scaleChange = value - this.scale;
    this.origin.x *= value / this.scale;
    this.origin.y *= value / this.scale;
    this.origin.x -= centerX * scaleChange;
    this.origin.y -= centerY * scaleChange;
    this.scale = value;
  }
  /**
   * Perform an delayed validation on the scene and generate warnings if necessary. This method should not be called when the editing is in progress.
   */
  validateDelayed() {
    if (this.error) {
      return;
    }
    this.warning = null;
    const opticalObjs = this.opticalObjs;
    if (opticalObjs.length < 100) {
      const stringifiedObjs = opticalObjs.map((obj) => JSON.stringify(obj.serialize()));
      for (var i = 0; i < opticalObjs.length; i++) {
        for (var j = i + 1; j < opticalObjs.length; j++) {
          if (stringifiedObjs[i] == stringifiedObjs[j]) {
            this.warning = `opticalObjs[${i}]==[${j}] ${opticalObjs[i].name || opticalObjs[i].constructor.type}: ` + instance.t("simulator:generalWarnings.identicalObjects");
            break;
          }
        }
      }
    }
  }
};
var Scene_default = Scene;

// app/notices/ray-optics/source/index.js
init_Simulator();

// app/notices/ray-optics/source/Editor.js
init_geometry();
init_sceneObjs();
init_Mouse();
var import_canvas2svg3 = __toESM(require_canvas2svg(), 1);
var import_file_saver = __toESM(require_FileSaver_min(), 1);
init_Simulator();
var Editor = class _Editor {
  /**
   * The limit of the undo data.
   */
  static UNDO_LIMIT = 50;
  /**
   * The minimal interval between two undo points.
   */
  static UNDO_INTERVAL = 250;
  /**
   * Create a new Editor instance.
   * @param {Scene} scene - The scene to be edited and simulated.
   * @param {HTMLCanvasElement} canvas - The top-layered canvas for user interaction.
   * @param {Simulator} simulator - The simulator.
   */
  constructor(scene, canvas, simulator) {
    this.scene = scene;
    this.scene.editor = this;
    this.canvas = canvas;
    this.simulator = simulator;
    this._lastDeviceIsTouch = window && window.matchMedia("(max-width: 991.98px)").matches || false;
    this.virtualCtrlKey = false;
    this.virtualShiftKey = false;
    this.mousePos = geometry_default.point(0, 0);
    this.lastMousePos = null;
    this.isConstructing = false;
    this.draggingObjIndex = -1;
    this.positioningObjIndex = -1;
    this.dragContext = {};
    this.selectedObjIndex = -1;
    this.hoveredObjIndex = -1;
    this.externalHoverIndex = -1;
    this.externalHighlightIndices = [];
    this.externalHighlightPoints = [];
    this.externalHighlightPrimitiveCurveIds = [];
    this.addingObjType = "";
    this.undoData = [this.scene.toJSON()];
    this.lastActionTime = /* @__PURE__ */ new Date();
    this.lastActionJson = this.scene.toJSON();
    this.undoIndex = 0;
    this.undoLBound = 0;
    this.undoUBound = 0;
    this.isInCropMode = false;
    this.pendingControlPointSelection = false;
    this.pendingControlPoints = [];
    this.pendingObjectSelection = false;
    this.pendingObjectIndex = -1;
    this.addingModuleName = "";
    this.eventListeners = {};
    this.delayedValidationTimerId = -1;
    this.minimalDragLength = 3;
    this.longPressTimer = null;
    this.longPressTriggered = false;
    this.longPressTouchPos = null;
    this.longPressDuration = 500;
    this.longPressMoveThreshold = 10;
    this.initCanvas();
  }
  /**
   * Whether any object in the scene can be selected (i.e. at least one is unlocked).
   * @returns {boolean}
   */
  canSelectAnyObject() {
    if (!this.scene.lockObjs) return true;
    return this.scene.objs.some((obj) => obj && obj.locked === "unlocked");
  }
  /**
   * Whether the object at the given index is locked (not selectable, not draggable).
   * @param {number} objIndex - The object index.
   * @returns {boolean}
   */
  isObjLocked(objIndex) {
    const obj = this.scene.objs[objIndex];
    if (!obj) return false;
    if (obj.locked === "locked") return true;
    if (obj.locked === "unlocked") return false;
    return this.scene.lockObjs;
  }
  /**
   * Add an event listener to the editor.
   * @param {string} eventName - The name of the event.
   * @param {function} callback - The callback function.
   */
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }
  /**
   * Emit an event.
   * @param {string} eventName - The name of the event.
   * @param {any} data - The data to be passed to the callback functions.
   */
  emit(eventName, data) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].forEach((callback) => callback(data));
    }
  }
  /**
   * The event when the mouse coordinate changes. This is different from the actual mousemove, since the grid snapping is considered, and the coordnates can also be updated by other events such as zooming.
   * @event Editor#mouseCoordinateChange
   * @type {object}
   * @property {Point} mousePos - The position of the mouse in the scene. Null if the mouse is out of the canvas.
   */
  /**
   * The event when the selection changes. This may also be triggered if the same object is selected again.
   * @event Editor#selectionChange
   * @type {object}
   * @property {number} oldIndex - The index of the previously selected object.
   * @property {number} newIndex - The index of the newly selected object.
   */
  /**
   * The event when the user interacts with the canvas during the positioning of an object, so that the new coordinates are assumed to be confirmed.
   * @event Editor#requestPositioningComfirm
   * @type {object}
   * @property {boolean} ctrl - Whether the Ctrl key is held down.
   * @property {boolean} shift - Whether the Shift key is held down.
   */
  /**
   * The event when the positioning of an object starts.
   * @event Editor#positioningStart
   * @type {object}
   * @property {DragContext} dragContext - The context of the positioning action, which is the same as the drag context if the user instead drags the control point to be positioned.
   */
  /**
   * The event when the positioning of an object ends (either confirmed or canceled).
   * @event Editor#positioningEnd
   */
  /**
   * The event when a double-click or right-click happens on an object body (not a control point).
   * @event Editor#objectBodyClick
   * @type {object}
   * @property {Point} mousePos - The mouse position in the scene.
   * @property {Point} screenPos - The screen position of the click.
   * @property {number} targetObjIndex - The index of the clicked object.
   */
  /**
   * The event when the user clicks without Ctrl while creating a handle with 2+ bound items.
   * @event Editor#handleCreationHint
   * @type {object}
   * @property {Point} screenPos - The screen position of the click.
   */
  /**
   * The event when the scene is loaded. If the scene contains resources that takes time to load, this event is emitted every time a resource is loaded, where the last event has the `completed` property set to `true`.
   * @event Editor#sceneLoaded
   * @type {object}
   * @property {boolean} needFullUpdate - Whether the UI needs a full update.
   * @property {boolean} completed - Whether the loading is completed.
   */
  /**
   * The event when a new action is done and the UI (e.g. code editor) should be updated.
   * @event Editor#newAction
   * @type {object}
   * @property {string} oldJSON - The JSON string representing the scene before the action.
   * @property {string} newJSON - The JSON string representing the scene after the action.
   * @property {boolean} fromJsonEditor - Whether the action is from the JSON editor.
   */
  /**
   * The event when the scale of the scene is changed.
   * @event Editor#scaleChange
   */
  /**
   * The event when a new undo data is pushed.
   * @event Editor#newUndoPoint
   */
  /**
   * The event when the user undo an action.
   * @event Editor#undo
   */
  /**
   * The event when the user redo an action.
   * @event Editor#redo
   */
  /**
   * The event when the error and warning messages in the UI should be updated.
   * @event requestUpdateErrorAndWarning
   */
  /**
   * The event when the device type (touch/mouse) changes.
   * @event deviceChange
   * @property {boolean} lastDeviceIsTouch - Whether the last interaction is done by a touch device.
   */
  /**
   * Getter for lastDeviceIsTouch.
   * @returns {boolean} Whether the last interaction is done by a touch device.
   */
  get lastDeviceIsTouch() {
    return this._lastDeviceIsTouch;
  }
  /**
   * Setter for lastDeviceIsTouch that emits deviceChange event when value changes.
   * @param {boolean} value - Whether the last interaction is done by a touch device.
   */
  set lastDeviceIsTouch(value) {
    if (this._lastDeviceIsTouch !== value) {
      this._lastDeviceIsTouch = value;
      this.emit("deviceChange", { lastDeviceIsTouch: value });
    }
  }
  /**
   * Wrap a touch event to override ctrlKey and shiftKey with virtual key states.
   * @param {TouchEvent} e - The original touch event.
   * @returns {Proxy} A proxy that intercepts ctrlKey and shiftKey access.
   */
  wrapTouchEvent(e) {
    const virtualCtrlKey = this.virtualCtrlKey;
    const virtualShiftKey = this.virtualShiftKey;
    return new Proxy(e, {
      get(target, prop) {
        if (prop === "ctrlKey") {
          return target.ctrlKey || virtualCtrlKey;
        }
        if (prop === "shiftKey") {
          return target.shiftKey || virtualShiftKey;
        }
        const value = target[prop];
        if (typeof value === "function") {
          return value.bind(target);
        }
        return value;
      }
    });
  }
  /**
   * Initialize the canvas event listeners.
   */
  getCanvasPosition() {
    const rect = this.canvas.getBoundingClientRect();
    return { left: rect.left + window.scrollX, top: rect.top + window.scrollY };
  }
  initCanvas() {
    let lastTouchTime = -1;
    const self2 = this;
    this.canvas.addEventListener("mousedown", function(e) {
      if (self2.lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
      self2.lastDeviceIsTouch = false;
      if (self2.scene.error) {
        self2.canvas.style.cursor = "not-allowed";
        return;
      }
      e.preventDefault();
      self2.canvas.focus();
      self2.onCanvasMouseDown(e);
    });
    this.canvas.addEventListener("mousemove", function(e) {
      if (self2.lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
      self2.lastDeviceIsTouch = false;
      if (self2.scene.error) {
        self2.canvas.style.cursor = "not-allowed";
        return;
      }
      e.preventDefault();
      self2.onCanvasMouseMove(e);
    });
    this.canvas.addEventListener("mouseup", function(e) {
      if (self2.lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
      self2.lastDeviceIsTouch = false;
      if (self2.scene.error) {
        self2.canvas.style.cursor = "not-allowed";
        return;
      }
      self2.onCanvasMouseUp(e);
    });
    this.canvas.addEventListener("mouseout", function(e) {
      if (self2.lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
      self2.lastDeviceIsTouch = false;
      if (self2.draggingObjIndex != -1) {
        self2.onCanvasMouseUp(e);
      }
      self2.hoveredObjIndex = -1;
      self2.emit("mouseCoordinateChange", { mousePos: null });
      self2.simulator.updateSimulation(true, true);
    });
    let lastZoomTime = 0;
    let zoomThrottle = 16;
    this.canvas.addEventListener("wheel", function(e) {
      const canvasOffset = self2.getCanvasPosition();
      e.preventDefault();
      var now = Date.now();
      if (now - lastZoomTime < zoomThrottle) return;
      lastZoomTime = now;
      const deltaY = e.deltaY || e.detail || e.wheelDelta;
      const currentScale = self2.scene.scale * self2.scene.lengthScale;
      const zoomSpeed = Math.max(0.05, currentScale * 0.05);
      let newScale = currentScale;
      if (deltaY > 0) {
        newScale = currentScale - zoomSpeed;
      } else if (deltaY < 0) {
        newScale = currentScale + zoomSpeed;
      }
      newScale = Math.max(0.25, Math.min(5, newScale));
      const finalScale = newScale * 100;
      self2.setScaleWithCenter(
        finalScale / self2.scene.lengthScale / 100,
        (e.pageX - canvasOffset.left) / self2.scene.scale,
        (e.pageY - canvasOffset.top) / self2.scene.scale
      );
      self2.onActionComplete();
    }, false);
    let initialPinchDistance = null;
    let lastScale = 1;
    let lastX = 0;
    let lastY = 0;
    this.canvas.addEventListener("touchstart", function(e) {
      if (self2.scene.error) return;
      self2.lastDeviceIsTouch = true;
      lastTouchTime = Date.now();
      const wrappedEvent = self2.wrapTouchEvent(e);
      if (e.touches.length === 2) {
        self2.cancelLongPress();
        e.preventDefault();
        lastX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
        lastY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
        if (self2.isConstructing || self2.draggingObjIndex >= 0) {
          self2.onCanvasMouseUp(wrappedEvent);
          self2.undo();
        } else {
          self2.onCanvasMouseUp(wrappedEvent);
        }
      } else {
        self2.canvas.focus();
        self2.onCanvasMouseMove(wrappedEvent);
        self2.onCanvasMouseDown(wrappedEvent);
        self2.startLongPress(e);
      }
    });
    this.canvas.addEventListener("touchmove", function(e) {
      const canvasOffset = self2.getCanvasPosition();
      if (self2.scene.error) return;
      self2.lastDeviceIsTouch = true;
      lastTouchTime = Date.now();
      e.preventDefault();
      if (self2.longPressTimer && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.pageX - self2.longPressTouchPos.x;
        const dy = touch.pageY - self2.longPressTouchPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > self2.longPressMoveThreshold) {
          self2.cancelLongPress();
        }
      }
      if (e.touches.length === 2) {
        self2.cancelLongPress();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (initialPinchDistance === null) {
          initialPinchDistance = distance;
          lastScale = self2.scene.scale;
        }
        const scaleFactor = distance / initialPinchDistance;
        let newScale = lastScale * scaleFactor;
        newScale = Math.max(0.25 / self2.scene.lengthScale, Math.min(5 / self2.scene.lengthScale, newScale));
        const x = (e.touches[0].pageX + e.touches[1].pageX) / 2;
        const y = (e.touches[0].pageY + e.touches[1].pageY) / 2;
        const dx2 = x - lastX;
        const dy2 = y - lastY;
        self2.scene.origin.x += dx2;
        self2.scene.origin.y += dy2;
        self2.setScaleWithCenter(newScale, (x - canvasOffset.left) / self2.scene.scale, (y - canvasOffset.top) / self2.scene.scale);
        lastX = x;
        lastY = y;
      } else {
        const wrappedEvent = self2.wrapTouchEvent(e);
        self2.onCanvasMouseMove(wrappedEvent);
      }
    });
    this.canvas.addEventListener("touchend", function(e) {
      if (self2.scene.error) return;
      self2.lastDeviceIsTouch = true;
      lastTouchTime = Date.now();
      self2.cancelLongPress();
      if (e.touches.length < 2) {
        initialPinchDistance = null;
        if (self2.longPressTriggered) {
          self2.longPressTriggered = false;
          return;
        }
        const wrappedEvent = self2.wrapTouchEvent(e);
        self2.onCanvasMouseUp(wrappedEvent);
        self2.onActionComplete();
      }
    });
    this.canvas.addEventListener("touchcancel", function(e) {
      if (self2.scene.error) return;
      self2.lastDeviceIsTouch = true;
      lastTouchTime = Date.now();
      self2.cancelLongPress();
      self2.longPressTriggered = false;
      initialPinchDistance = null;
      const wrappedEvent = self2.wrapTouchEvent(e);
      self2.onCanvasMouseUp(wrappedEvent);
    });
    this.canvas.addEventListener("dblclick", function(e) {
      if (self2.scene.error) return;
      self2.onCanvasDblClick(e);
    });
  }
  /**
   * Handle the equivalent of the mousedown event on the canvas, which can be triggered by both mouse and single touch.
   * @param {MouseEvent} e - The event.
   */
  onCanvasMouseDown(e) {
    const canvasOffset = this.getCanvasPosition();
    if (e.changedTouches) {
      var et = e.changedTouches[0];
      this.lastDeviceIsTouch = true;
    } else {
      var et = e;
      this.lastDeviceIsTouch = false;
    }
    const rawX = (et.pageX - canvasOffset.left - this.scene.origin.x) / this.scene.scale;
    const rawY = (et.pageY - canvasOffset.top - this.scene.origin.y) / this.scene.scale;
    this.lastMousePos = geometry_default.point(rawX, rawY);
    const truncX = this.truncateToBinaryFraction(rawX, this.scene.scale);
    const truncY = this.truncateToBinaryFraction(rawY, this.scene.scale);
    var mousePos_nogrid = geometry_default.point(truncX, truncY);
    var mousePos2;
    if (this.scene.snapToGrid && !(e.altKey && !this.isConstructing)) {
      mousePos2 = geometry_default.point(
        Math.round((et.pageX - canvasOffset.left - this.scene.origin.x) / this.scene.scale / this.scene.gridSize) * this.scene.gridSize,
        Math.round((et.pageY - canvasOffset.top - this.scene.origin.y) / this.scene.scale / this.scene.gridSize) * this.scene.gridSize
      );
    } else {
      mousePos2 = mousePos_nogrid;
    }
    if (this.positioningObjIndex != -1) {
      this.emit("requestPositioningComfirm", { ctrl: e.ctrlKey, shift: e.shiftKey });
      if (!(e.which && e.which == 3)) {
        return;
      }
    }
    if (!(e.which && (e.which == 1 || e.which == 3) || e.changedTouches)) {
      return;
    }
    if (this.scene.snapToGrid) {
      this.mousePos = geometry_default.point(Math.round((et.pageX - canvasOffset.left - this.scene.origin.x) / this.scene.scale / this.scene.gridSize) * this.scene.gridSize, Math.round((et.pageY - canvasOffset.top - this.scene.origin.y) / this.scene.scale / this.scene.gridSize) * this.scene.gridSize);
    } else {
      this.mousePos = mousePos_nogrid;
    }
    if (this.isConstructing) {
      if (e.which && e.which == 1 || e.changedTouches) {
        if (this.selectedObjIndex != this.scene.objs.length - 1) {
          this.selectObj(this.scene.objs.length - 1);
        }
        const ret2 = this.scene.objs[this.scene.objs.length - 1].onConstructMouseDown(new Mouse_default(mousePos_nogrid, this.scene, this.lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
        if (ret2 && ret2.isDone) {
          this.isConstructing = false;
          this.emit("resetVirtualKeys");
        }
        if (ret2 && ret2.requiresObjBarUpdate) {
          this.selectObj(this.selectedObjIndex);
        }
        this.simulator.updateSimulation(!this.scene.objs[this.scene.objs.length - 1].constructor.isOptical, true);
      }
    } else {
      if (this.canSelectAnyObject() != (e.altKey && this.addingObjType != "") && !(e.which == 3)) {
        this.dragContext = {};
        if (this.scene.mode == "observer") {
          if (geometry_default.distanceSquared(mousePos_nogrid, this.scene.observer.c) < this.scene.observer.r * this.scene.observer.r) {
            this.draggingObjIndex = -4;
            this.dragContext = {};
            this.dragContext.mousePos0 = this.mousePos;
            this.dragContext.mousePos1 = this.mousePos;
            this.dragContext.snapContext = {};
            return;
          }
        }
        var rets = this.selectionSearch(mousePos_nogrid);
        var ret = rets[0];
        if (ret.targetObjIndex != -1) {
          if (!e.ctrlKey && this.scene.objs.length > 0 && this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone) {
            const handle = this.scene.objs[0];
            const boundCount = handle.objIndices.length + handle.controlPoints.length;
            if (boundCount >= 2) {
              this.emit("handleCreationHint", {
                screenPos: geometry_default.point(e.pageX, e.pageY)
              });
            } else {
              this.removeObj(0);
              ret.targetObjIndex--;
            }
          }
          this.selectObj(ret.targetObjIndex);
          this.dragContext = ret.dragContext;
          this.dragContext.originalObj = this.scene.objs[ret.targetObjIndex].serialize();
          this.dragContext.hasDuplicated = false;
          this.draggingObjIndex = ret.targetObjIndex;
          if (e.ctrlKey) {
            if (this.dragContext.part === 0) {
              this.pendingObjectSelection = true;
              this.pendingObjectIndex = ret.targetObjIndex;
            } else if (this.dragContext.targetPoint) {
              this.pendingControlPointSelection = true;
              this.pendingControlPoints = rets;
            }
          }
          return;
        }
      }
      if (this.draggingObjIndex == -1) {
        if (this.scene.objs.length > 0 && this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone) {
          if (e.which == 3) {
            this.removeObj(0);
            this.simulator.updateSimulation(true, true);
          } else {
            this.finishHandleCreation(this.mousePos);
            this.hoveredObjIndex = 0;
            this.canvas.style.cursor = "pointer";
            this.simulator.updateSimulation(true, true);
            this.emit("resetVirtualKeys");
            return;
          }
        }
        if (this.addingObjType == "" || e.which == 3) {
          this.draggingObjIndex = -3;
          this.dragContext = {};
          this.dragContext.mousePos0 = this.mousePos;
          this.dragContext.mousePos1 = this.mousePos;
          this.dragContext.mousePos2 = this.scene.origin;
          this.dragContext.snapContext = {};
          this.selectObj(-1);
        } else {
          this.isConstructing = true;
          let referenceObj = {};
          if (this.scene.objs[this.selectedObjIndex]) {
            if (this.scene.objs[this.selectedObjIndex].constructor.type == this.addingObjType) {
              referenceObj = this.scene.objs[this.selectedObjIndex].serialize();
              delete referenceObj.name;
              delete referenceObj.locked;
            }
          }
          this.scene.pushObj(new sceneObjs_exports[this.addingObjType](this.scene, referenceObj));
          const ret2 = this.scene.objs[this.scene.objs.length - 1].onConstructMouseDown(new Mouse_default(mousePos_nogrid, this.scene, this.lastDeviceIsTouch));
          if (ret2 && ret2.isDone) {
            this.isConstructing = false;
            this.emit("resetVirtualKeys");
          }
          this.selectObj(this.scene.objs.length - 1);
          this.simulator.updateSimulation(!this.scene.objs[this.scene.objs.length - 1].constructor.isOptical, true);
        }
      }
    }
  }
  /**
   * Handle the equivalent of the mousemove event on the canvas, which can be triggered by both mouse and single touch.
   * @param {MouseEvent} e - The event.
   */
  onCanvasMouseMove(e) {
    const canvasOffset = this.getCanvasPosition();
    if (e.changedTouches) {
      var et = e.changedTouches[0];
    } else {
      var et = e;
    }
    const rawX = (et.pageX - canvasOffset.left - this.scene.origin.x) / this.scene.scale;
    const rawY = (et.pageY - canvasOffset.top - this.scene.origin.y) / this.scene.scale;
    if (this.lastMousePos) {
      const distanceSquared = geometry_default.distanceSquared(this.lastMousePos, geometry_default.point(rawX, rawY));
      if (distanceSquared < this.minimalDragLength * this.minimalDragLength / (this.scene.scale * this.scene.scale)) {
        return;
      }
      this.lastMousePos = null;
    }
    const truncX = this.truncateToBinaryFraction(rawX, this.scene.scale);
    const truncY = this.truncateToBinaryFraction(rawY, this.scene.scale);
    var mousePos_nogrid = geometry_default.point(truncX, truncY);
    var mousePos2;
    if (this.scene.snapToGrid && !(e.altKey && !this.isConstructing)) {
      mousePos2 = geometry_default.point(
        Math.round((et.pageX - canvasOffset.left - this.scene.origin.x) / this.scene.scale / this.scene.gridSize) * this.scene.gridSize,
        Math.round((et.pageY - canvasOffset.top - this.scene.origin.y) / this.scene.scale / this.scene.gridSize) * this.scene.gridSize
      );
    } else {
      mousePos2 = mousePos_nogrid;
    }
    this.pendingControlPointSelection = false;
    this.pendingObjectSelection = false;
    const isCreatingHandle = this.scene.objs.length > 0 && this.scene.objs[0].constructor.type === "Handle" && this.scene.objs[0].notDone;
    if (!this.isConstructing && this.draggingObjIndex == -1 && this.canSelectAnyObject()) {
      var ret = this.selectionSearch(mousePos_nogrid)[0];
      if (this.hoveredObjIndex != ret.targetObjIndex) {
        this.hoveredObjIndex = ret.targetObjIndex;
        this.simulator.updateSimulation(true, true);
      }
      if (ret.dragContext) {
        if (ret.dragContext.cursor) {
          this.canvas.style.cursor = ret.dragContext.cursor;
        } else if (ret.dragContext.targetPoint || ret.dragContext.targetPoint_) {
          this.canvas.style.cursor = "pointer";
        } else if (ret.dragContext.part == 0) {
          this.canvas.style.cursor = "move";
        } else {
          this.canvas.style.cursor = "";
        }
      } else if (this.scene.mode == "observer" && geometry_default.distanceSquared(this.mousePos, this.scene.observer.c) < this.scene.observer.r * this.scene.observer.r) {
        this.canvas.style.cursor = "pointer";
      } else if (isCreatingHandle) {
        if (!e.ctrlKey) {
          this.canvas.style.cursor = "alias";
          if (mousePos2) {
            this.scene.objs[0].p1 = mousePos2;
            this.simulator.updateSimulation(true, true);
          }
        } else {
          this.canvas.style.cursor = "";
          if (this.scene.objs[0].p1) {
            this.scene.objs[0].p1 = null;
            this.simulator.updateSimulation(true, true);
          }
        }
      } else {
        this.canvas.style.cursor = "";
      }
    }
    if (mousePos2.x == this.mousePos.x && mousePos2.y == this.mousePos.y) {
      return;
    }
    this.mousePos = mousePos2;
    this.emit("mouseCoordinateChange", { mousePos: this.mousePos });
    if (this.isConstructing) {
      this.hoveredObjIndex = this.scene.objs.length - 1;
      const ret2 = this.scene.objs[this.scene.objs.length - 1].onConstructMouseMove(new Mouse_default(this.mousePos, this.scene, this.lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
      if (ret2 && ret2.isDone) {
        this.isConstructing = false;
        this.emit("resetVirtualKeys");
      }
      if (ret2 && ret2.requiresObjBarUpdate) {
        this.selectObj(this.selectedObjIndex);
      }
      this.simulator.updateSimulation(!this.scene.objs[this.scene.objs.length - 1].constructor.isOptical, true);
    } else {
      if (this.draggingObjIndex == -4) {
        if (e.shiftKey) {
          var mousePos_snapped = new Mouse_default(this.mousePos, this.scene, this.lastDeviceIsTouch).getPosSnappedToDirection(this.dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], this.dragContext.snapContext);
        } else {
          var mousePos_snapped = this.mousePos;
          this.dragContext.snapContext = {};
        }
        var mouseDiffX = mousePos_snapped.x - this.dragContext.mousePos1.x;
        var mouseDiffY = mousePos_snapped.y - this.dragContext.mousePos1.y;
        this.scene.observer.c.x += mouseDiffX;
        this.scene.observer.c.y += mouseDiffY;
        this.dragContext.mousePos1 = mousePos_snapped;
        this.simulator.updateSimulation(false, true);
      }
      if (this.draggingObjIndex >= 0) {
        this.scene.objs[this.draggingObjIndex].onDrag(new Mouse_default(mousePos_nogrid, this.scene, this.lastDeviceIsTouch, e.altKey * 1), this.dragContext, e.ctrlKey, e.shiftKey);
        if (this.dragContext.part == 0) {
          if (e.ctrlKey && !this.dragContext.hasDuplicated) {
            this.scene.pushObj(new sceneObjs_exports[this.scene.objs[this.draggingObjIndex].constructor.type](this.scene, this.dragContext.originalObj));
            this.dragContext.hasDuplicated = true;
          }
          if (!e.ctrlKey && this.dragContext.hasDuplicated) {
            this.scene.objs.length--;
            this.dragContext.hasDuplicated = false;
          }
        }
        this.simulator.updateSimulation(!this.scene.objs[this.draggingObjIndex].constructor.isOptical, true);
        if (this.dragContext.requiresObjBarUpdate) {
          this.selectObj(this.selectedObjIndex);
        }
      }
      if (this.draggingObjIndex == -3 && this.dragContext.mousePos1) {
        var mouseDiffX = this.mousePos.x - this.dragContext.mousePos1.x;
        var mouseDiffY = this.mousePos.y - this.dragContext.mousePos1.y;
        this.scene.origin.x = mouseDiffX * this.scene.scale + this.dragContext.mousePos2.x;
        this.scene.origin.y = mouseDiffY * this.scene.scale + this.dragContext.mousePos2.y;
        this.simulator.updateSimulation();
      }
    }
  }
  /**
   * Truncates a number to the nearest binary fraction while ensuring the error is less than 1 pixel.
   * @param {number} value - The value to truncate
   * @param {number} scale - The scale factor (pixels per unit)
   * @returns {number} The truncated value
   */
  truncateToBinaryFraction(value, scale) {
    const minError = 1 / scale;
    let step = 1;
    while (step > minError) {
      step /= 2;
    }
    return Math.round(value / step) * step;
  }
  /**
   * Handle the equivalent of the mouseup event on the canvas, which can be triggered by both mouse and single touch.
   * @param {MouseEvent} e - The event.
   */
  onCanvasMouseUp(e) {
    const canvasOffset = this.getCanvasPosition();
    if (e.changedTouches) {
      var et = e.changedTouches[0];
    } else {
      var et = e;
    }
    const rawX = (et.pageX - canvasOffset.left - this.scene.origin.x) / this.scene.scale;
    const rawY = (et.pageY - canvasOffset.top - this.scene.origin.y) / this.scene.scale;
    const truncX = this.truncateToBinaryFraction(rawX, this.scene.scale);
    const truncY = this.truncateToBinaryFraction(rawY, this.scene.scale);
    var mousePos_nogrid = geometry_default.point(truncX, truncY);
    var mousePos2;
    if (this.scene.snapToGrid && !(e.altKey && !this.isConstructing)) {
      mousePos2 = geometry_default.point(
        Math.round((et.pageX - canvasOffset.left - this.scene.origin.x) / this.scene.scale / this.scene.gridSize) * this.scene.gridSize,
        Math.round((et.pageY - canvasOffset.top - this.scene.origin.y) / this.scene.scale / this.scene.gridSize) * this.scene.gridSize
      );
    } else {
      mousePos2 = mousePos_nogrid;
    }
    if (this.isConstructing) {
      if (e.which && e.which == 1 || e.changedTouches) {
        const ret = this.scene.objs[this.scene.objs.length - 1].onConstructMouseUp(new Mouse_default(mousePos_nogrid, this.scene, this.lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
        if (ret && ret.isDone) {
          this.isConstructing = false;
        }
        if (ret && ret.requiresObjBarUpdate) {
          this.selectObj(this.selectedObjIndex);
        }
        this.simulator.updateSimulation(!this.scene.objs[this.scene.objs.length - 1].constructor.isOptical, true);
        if (!this.isConstructing) {
          this.onActionComplete();
          this.emit("resetVirtualKeys");
          if (!this.canSelectAnyObject()) {
            this.hoveredObjIndex = -1;
            this.simulator.updateSimulation(true, true);
          }
        }
      }
    } else {
      if (this.pendingControlPointSelection) {
        this.pendingControlPointSelection = false;
        this.addControlPointsForHandle(this.pendingControlPoints);
        this.hoveredObjIndex = -1;
        this.simulator.updateSimulation(true, true);
      }
      if (this.pendingObjectSelection) {
        this.pendingObjectSelection = false;
        this.addObjectForHandle(this.pendingObjectIndex);
        this.hoveredObjIndex = -1;
        this.simulator.updateSimulation(true, true);
      }
      if (e.which && e.which == 3 && this.draggingObjIndex == -3 && this.mousePos.x == this.dragContext.mousePos0.x && this.mousePos.y == this.dragContext.mousePos0.y) {
        this.draggingObjIndex = -1;
        this.dragContext = {};
        if (!this.isConstructingHandle()) {
          this.emit("resetVirtualKeys");
        }
        this.onCanvasDblClick(e);
        return;
      }
      this.onActionComplete();
      this.draggingObjIndex = -1;
      this.dragContext = {};
      if (!this.isConstructingHandle()) {
        this.emit("resetVirtualKeys");
      }
    }
  }
  /**
   * Handle the equivalent of the dblclick event on the canvas.
   * @param {MouseEvent} e - The event.
   */
  onCanvasDblClick(e) {
    const canvasOffset = this.getCanvasPosition();
    const rawX = (e.pageX - canvasOffset.left - this.scene.origin.x) / this.scene.scale;
    const rawY = (e.pageY - canvasOffset.top - this.scene.origin.y) / this.scene.scale;
    const truncX = this.truncateToBinaryFraction(rawX, this.scene.scale);
    const truncY = this.truncateToBinaryFraction(rawY, this.scene.scale);
    this.mousePos = geometry_default.point(truncX, truncY);
    if (this.isConstructing) {
    } else if (this.lastMousePos && new Mouse_default(this.mousePos, this.scene, this.lastDeviceIsTouch).isOnPoint(this.lastMousePos)) {
      this.dragContext = {};
      if (this.scene.mode == "observer") {
        if (geometry_default.distanceSquared(this.mousePos, this.scene.observer.c) < this.scene.observer.r * this.scene.observer.r) {
          this.positioningObjIndex = -4;
          this.dragContext = {};
          this.dragContext.targetPoint = geometry_default.point(this.scene.observer.c.x, this.scene.observer.c.y);
          this.dragContext.snapContext = {};
          this.emit("positioningStart", { dragContext: this.dragContext });
          return;
        }
      }
      var ret = this.selectionSearch(this.mousePos)[0];
      if (ret.targetObjIndex != -1 && ret.dragContext.targetPoint) {
        this.selectObj(ret.targetObjIndex);
        this.dragContext = ret.dragContext;
        this.dragContext.originalObj = this.scene.objs[ret.targetObjIndex].serialize();
        this.dragContext.hasDuplicated = false;
        this.positioningObjIndex = ret.targetObjIndex;
        this.emit("positioningStart", { dragContext: this.dragContext });
      } else if (ret.targetObjIndex != -1 && !ret.dragContext.targetPoint) {
        this.emit("objectBodyClick", {
          mousePos: this.mousePos,
          screenPos: geometry_default.point(e.pageX, e.pageY),
          targetObjIndex: ret.targetObjIndex
        });
      }
    }
  }
  /**
   * search for best object to select at mouse position
   * @param {Point} mousePos_nogrid - The mouse position in the scene (without snapping to grid).
   * @returns {SelectionSearchResult[]} - The search results.
   */
  selectionSearch(mousePos_nogrid) {
    var i;
    var click_lensq = Infinity;
    var click_lensq_temp;
    var targetObjIndex = -1;
    var targetIsPoint = false;
    var dragContext;
    var targetIsSelected = false;
    var results = [];
    for (var i = 0; i < this.scene.objs.length; i++) {
      if (typeof this.scene.objs[i] != "undefined") {
        let dragContext_ = this.scene.objs[i].checkMouseOver(new Mouse_default(mousePos_nogrid, this.scene, this.lastDeviceIsTouch));
        if (dragContext_ && !this.isObjLocked(i)) {
          if (dragContext_.targetPoint || dragContext_.targetPoint_) {
            if (!targetIsPoint) {
              targetIsPoint = true;
              results = [];
            }
            var click_lensq_temp = geometry_default.distanceSquared(mousePos_nogrid, dragContext_.targetPoint || dragContext_.targetPoint_);
            if (click_lensq_temp <= click_lensq || targetObjIndex == this.selectedObjIndex) {
              targetObjIndex = i;
              click_lensq = click_lensq_temp;
              dragContext = dragContext_;
              if (!targetIsSelected) {
                results.unshift({ dragContext, targetObjIndex });
              } else {
                results.push({ dragContext, targetObjIndex });
              }
              if (targetObjIndex == this.selectedObjIndex) targetIsSelected = true;
            }
          } else if (!targetIsPoint) {
            targetObjIndex = i;
            dragContext = dragContext_;
            results.unshift({ dragContext, targetObjIndex });
          }
        }
      }
    }
    if (results.length == 0) {
      results.push({ targetObjIndex: -1 });
    }
    return results;
  }
  /**
   * Add control points for a handle (create a new handle or add to the currently consturcting handle).
   * @param {ControlPoint[]} controlPoints - The control points to add.
   */
  addControlPointsForHandle(controlPoints) {
    if (!(this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone)) {
      this.scene.unshiftObj(new Handle2(this.scene, { notDone: true, transformation: "xTranslation" }));
      if (this.selectedObjIndex >= 0) this.selectedObjIndex++;
      for (var i in controlPoints) {
        controlPoints[i].targetObjIndex++;
      }
    }
    for (var i in controlPoints) {
      this.scene.objs[0].addControlPoint(controlPoints[i]);
    }
    this.simulator.updateSimulation(true, true);
  }
  /**
   * Add an entire object to a handle (create a new handle or add to the currently constructing handle).
   * @param {number} objIndex - The index of the object to bind to the handle.
   */
  addObjectForHandle(objIndex) {
    if (!(this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone)) {
      this.scene.unshiftObj(new Handle2(this.scene, { notDone: true, transformation: "xTranslation" }));
      if (this.selectedObjIndex >= 0) this.selectedObjIndex++;
      objIndex++;
    }
    this.scene.objs[0].addObject(objIndex);
    this.simulator.updateSimulation(true, true);
  }
  /**
   * Finish the creation of a handle.
   * @param {Point} point - The point for the position of the handle.
   */
  finishHandleCreation(point) {
    this.scene.objs[0].finishHandle(point);
    this.simulator.updateSimulation(true, true);
    this.selectObj(0);
  }
  /**
   * Check if a handle is currently being constructed.
   * @returns {boolean} True if a handle is being constructed, false otherwise.
   */
  isConstructingHandle() {
    return this.scene.objs[0] && this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone;
  }
  /**
   * Select an object.
   * @param {number} index - The index of the object to select.
   */
  selectObj(index) {
    if (this.scene.objs[0] && this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone) {
      this.selectedObjIndex = -1;
      this.emit("selectionChange", { oldIndex: this.selectedObjIndex, newIndex: -1 });
      return;
    }
    if (index < 0 || index >= this.scene.objs.length) {
      this.emit("selectionChange", { oldIndex: this.selectedObjIndex, newIndex: -1 });
      this.selectedObjIndex = -1;
      return;
    }
    this.emit("selectionChange", { oldIndex: this.selectedObjIndex, newIndex: index });
    this.selectedObjIndex = index;
  }
  /**
   * Return {@link sceneObjs.ModuleObj} instances for a given module name that are considered “active” for
   * sidebar / batch property behavior.
   *
   * If the top-level {@link Editor#selectedObjIndex} points to a {@link sceneObjs.ModuleObj} with the same
   * `module`, that instance is the only active one. Otherwise every instance in the scene is active, including
   * instances nested under another module’s expanded `objs`.
   *
   * @param {string} moduleId - The module name (`ModuleObj#module`), same as in `scene.modules`.
   * @returns {Array} Module instances (possibly empty). Elements are {@link sceneObjs.ModuleObj}.
   */
  getActiveModuleInstances(moduleId) {
    const all = [];
    const collect = (objs) => {
      if (!Array.isArray(objs)) return;
      for (const obj of objs) {
        if (!obj) continue;
        if (obj.constructor?.type === "ModuleObj") {
          if (obj.module === moduleId) {
            all.push(obj);
          }
          collect(obj.objs);
        }
      }
    };
    collect(this.scene.objs);
    const i = this.selectedObjIndex;
    if (i >= 0 && i < this.scene.objs.length) {
      const sel = this.scene.objs[i];
      if (sel?.constructor?.type === "ModuleObj" && sel.module === moduleId) {
        return [sel];
      }
    }
    return all;
  }
  /**
   * Confirm the positioning in the coordinate box.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @param {boolean} ctrl - Whether the Ctrl key is pressed.
   * @param {boolean} shift - Whether the Shift key is pressed.
   */
  confirmPositioning(x, y, ctrl, shift) {
    if (this.positioningObjIndex == -4) {
      this.scene.observer.c.x = x;
      this.scene.observer.c.y = y;
      this.simulator.updateSimulation(false, true);
    } else {
      this.scene.objs[this.positioningObjIndex].onDrag(new Mouse_default(geometry_default.point(x, y), this.scene, this.lastDeviceIsTouch, 2), this.dragContext, ctrl, shift);
      this.simulator.updateSimulation(!this.scene.objs[this.positioningObjIndex].constructor.isOptical, true);
    }
    this.onActionComplete();
    this.endPositioning();
  }
  /**
   * End the positioning in the coordinate box.
   */
  endPositioning() {
    this.emit("positioningEnd");
    this.positioningObjIndex = -1;
    this.dragContext = {};
  }
  /**
   * Remove an object.
   * @param {number} index - The index of the object to remove.
   */
  removeObj(index) {
    this.isConstructing = false;
    this.scene.removeObj(index);
    this.selectedObjIndex--;
    this.selectObj(this.selectedObjIndex);
  }
  /**
   * Set the scale of the scene with respect to the center point of the canvas.
   * @param {number} value - The new scale.
   */
  setScale(value) {
    this.setScaleWithCenter(value, this.canvas.width / this.scene.scale / 2, this.canvas.height / this.scene.scale / 2);
  }
  /**
   * Set the scale of the scene while keeping a given center point fixed.
   * @param {number} value - The new scale factor.
   * @param {number} centerX - The x-coordinate of the center point.
   * @param {number} centerY - The y-coordinate of the center point.
   */
  setScaleWithCenter(value, centerX, centerY) {
    this.scene.setScaleWithCenter(value, centerX, centerY);
    this.emit("scaleChange");
    this.simulator.updateSimulation();
  }
  /**
   * Load a JSON string of the scene to the editor.
   * @param {string} json - The JSON string of the scene.
   */
  loadJSON(json) {
    const self2 = this;
    this.scene.setViewportSize(this.canvas.width / this.simulator.dpr, this.canvas.height / this.simulator.dpr);
    this.scene.loadJSON(json, function(needFullUpdate, completed) {
      self2.emit("sceneLoaded", { needFullUpdate, completed });
      if (needFullUpdate) {
        self2.simulator.updateSimulation();
      } else {
        setTimeout(function() {
          self2.simulator.updateSimulation(true, true);
        }, 1);
      }
    });
    this.selectObj(-1);
    this.simulator.updateSimulation();
  }
  /**
   * Called when a change (action) is completed. This function will update the undo data, sync the JSON editor, etc.
   * @param {boolean} fromJsonEditor - Whether the action is from the JSON editor.
   */
  onActionComplete(fromJsonEditor = false) {
    if (this.scene.error) {
      return;
    }
    const newJSON = this.scene.toJSON();
    const oldJSON = this.lastActionJson;
    this.lastActionJson = newJSON;
    this.emit("newAction", { newJSON, oldJSON, fromJsonEditor });
    this.emit("requestUpdateErrorAndWarning");
    this.requireDelayedValidation();
    if (/* @__PURE__ */ new Date() - this.lastActionTime > _Editor.UNDO_INTERVAL && newJSON != oldJSON) {
      this.undoIndex = (this.undoIndex + 1) % _Editor.UNDO_LIMIT;
      this.emit("newUndoPoint");
      this.undoUBound = this.undoIndex;
      if (this.undoUBound == this.undoLBound) {
        this.undoLBound = (this.undoLBound + 1) % _Editor.UNDO_LIMIT;
      }
    }
    this.undoData[this.undoIndex] = this.lastActionJson;
    this.lastActionTime = /* @__PURE__ */ new Date();
  }
  /**
   * Undo the last edit.
   */
  undo() {
    if (this.isConstructing) {
      const constructingObjType = this.scene.objs[this.scene.objs.length - 1].constructor.type;
      const ret = this.scene.objs[this.scene.objs.length - 1].onConstructUndo();
      if (ret && ret.isCancelled) {
        this.isConstructing = false;
        this.scene.objs.length--;
        this.selectObj(-1);
      }
      this.simulator.updateSimulation(!sceneObjs_exports[constructingObjType].isOptical, true);
      return;
    }
    if (this.positioningObjIndex != -1) {
      this.endPositioning();
      return;
    }
    if (this.undoIndex == this.undoLBound)
      return;
    this.undoIndex = (this.undoIndex + (_Editor.UNDO_LIMIT - 1)) % _Editor.UNDO_LIMIT;
    this.loadJSON(this.undoData[this.undoIndex]);
    this.lastActionJson = this.undoData[this.undoIndex];
    this.emit("undo");
    this.requireDelayedValidation();
  }
  /**
   * Redo the last edit.
   */
  redo() {
    this.isConstructing = false;
    this.endPositioning();
    if (this.undoIndex == this.undoUBound)
      return;
    this.undoIndex = (this.undoIndex + 1) % _Editor.UNDO_LIMIT;
    this.loadJSON(this.undoData[this.undoIndex]);
    this.lastActionJson = this.undoData[this.undoIndex];
    this.emit("redo");
    this.requireDelayedValidation();
  }
  /**
   * Enter the crop mode that allows the user to crop the scene for exporting.
   */
  enterCropMode() {
    this.isInCropMode = true;
    var cropBoxIndex = -1;
    for (var i = 0; i < this.scene.objs.length; i++) {
      if (this.scene.objs[i].constructor.type == "CropBox") {
        cropBoxIndex = i;
        break;
      }
    }
    if (cropBoxIndex == -1) {
      this.scene.pushObj(new CropBox2(this.scene, {
        p1: geometry_default.point((this.canvas.width * 0.2 / this.simulator.dpr - this.scene.origin.x) / this.scene.scale, ((120 + (this.canvas.height - 120) * 0.2) / this.simulator.dpr - this.scene.origin.y) / this.scene.scale),
        p4: geometry_default.point((this.canvas.width * 0.8 / this.simulator.dpr - this.scene.origin.x) / this.scene.scale, ((120 + (this.canvas.height - 120) * 0.8) / this.simulator.dpr - this.scene.origin.y) / this.scene.scale)
      }));
      cropBoxIndex = this.scene.objs.length - 1;
    }
    this.selectObj(cropBoxIndex);
    this.simulator.updateSimulation(true, true);
  }
  /**
   * Confirm the crop box and export the cropped scene.
   * @param {CropBox} cropBox - The crop box.
   */
  confirmCrop(cropBox) {
    if (cropBox.format == "svg") {
      this.exportSVG(cropBox);
    } else {
      this.exportImage(cropBox);
    }
    this.isInCropMode = false;
    this.selectObj(-1);
    this.simulator.updateSimulation(true, true);
  }
  /**
   * Exit the crop mode without exporting the cropped scene.
   */
  cancelCrop() {
    this.isInCropMode = false;
    this.selectObj(-1);
    this.simulator.updateSimulation(true, true);
  }
  /**
   * Export the cropped scene as an SVG file.
   * @param {CropBox} cropBox - The crop box.
   */
  exportSVG(cropBox) {
    const self2 = this;
    const exportingScene = new Scene_default();
    exportingScene.backgroundImage = this.scene.backgroundImage;
    exportingScene.loadJSON(this.scene.toJSON(), function(needFullUpdate, completed) {
      if (!completed) {
        return;
      }
      exportingScene.scale = 1;
      exportingScene.origin = { x: -cropBox.p1.x * exportingScene.scale, y: -cropBox.p1.y * exportingScene.scale };
      const imageWidth = cropBox.p4.x - cropBox.p1.x;
      const imageHeight = cropBox.p4.y - cropBox.p1.y;
      const ctxSVG = new import_canvas2svg3.default(imageWidth, imageHeight);
      if (!cropBox.transparent) {
        ctxSVG.fillStyle = `rgb(${Math.round(exportingScene.theme.background.color.r * 255)}, ${Math.round(exportingScene.theme.background.color.g * 255)}, ${Math.round(exportingScene.theme.background.color.b * 255)})`;
        ctxSVG.fillRect(0, 0, imageWidth, imageHeight);
      }
      const exportSimulator = new Simulator_default(exportingScene, ctxSVG, null, null, null, null, false, cropBox.rayCountLimit || 1e7, null, null, (width, height) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
      });
      function onSimulationEnd() {
        const blob = new Blob([ctxSVG.getSerializedSvg()], { type: "image/svg+xml" });
        (0, import_file_saver.saveAs)(blob, (self2.scene.name || "export") + ".svg");
      }
      exportSimulator.on("simulationComplete", onSimulationEnd);
      exportSimulator.on("simulationStop", onSimulationEnd);
      exportSimulator.updateSimulation();
    });
  }
  /**
   * Export the cropped scene as a PNG image.
   * @param {CropBox} cropBox - The crop box.
   */
  exportImage(cropBox) {
    const self2 = this;
    const exportingScene = new Scene_default();
    exportingScene.backgroundImage = this.scene.backgroundImage;
    exportingScene.loadJSON(this.scene.toJSON(), function(needFullUpdate, completed) {
      if (!completed) {
        return;
      }
      exportingScene.scale = cropBox.width / (cropBox.p4.x - cropBox.p1.x);
      exportingScene.origin = { x: -cropBox.p1.x * exportingScene.scale, y: -cropBox.p1.y * exportingScene.scale };
      if (cropBox.transparent && exportingScene.theme.background.color.r == 0 && exportingScene.theme.background.color.g == 0 && exportingScene.theme.background.color.b == 0) {
        exportingScene.theme.background.color = { r: 0.01, g: 0.01, b: 0.01 };
      }
      const imageWidth = cropBox.width;
      const imageHeight = cropBox.width * (cropBox.p4.y - cropBox.p1.y) / (cropBox.p4.x - cropBox.p1.x);
      const canvases = [];
      const ctxs = [];
      for (let i = 0; i < 4; i++) {
        canvases.push(document.createElement("canvas"));
        ctxs.push(canvases[i].getContext("2d"));
        canvases[i].width = imageWidth;
        canvases[i].height = imageHeight;
      }
      let canvasGl = document.createElement("canvas");
      let gl = null;
      if (self2.simulator.glMain) {
        canvasGl.width = imageWidth;
        canvasGl.height = imageHeight;
        const contextAttributes = {
          alpha: true,
          premultipliedAlpha: true,
          antialias: false
        };
        gl = canvasGl.getContext("webgl", contextAttributes) || canvasGl.getContext("experimental-webgl", contextAttributes);
      }
      const exportSimulator = new Simulator_default(exportingScene, ctxs[0], ctxs[1], ctxs[2], ctxs[3], document.createElement("canvas").getContext("2d"), false, cropBox.rayCountLimit || 1e7, gl, null, (width, height) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
      });
      function onSimulationEnd() {
        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = imageWidth;
        finalCanvas.height = imageHeight;
        const finalCtx = finalCanvas.getContext("2d");
        if (!cropBox.transparent) {
          finalCtx.fillStyle = `rgb(${Math.round(exportingScene.theme.background.color.r * 255)}, ${Math.round(exportingScene.theme.background.color.g * 255)}, ${Math.round(exportingScene.theme.background.color.b * 255)})`;
          finalCtx.fillRect(0, 0, cropBox.width, cropBox.width * (cropBox.p4.y - cropBox.p1.y) / (cropBox.p4.x - cropBox.p1.x));
        }
        finalCtx.drawImage(canvases[1], 0, 0);
        finalCtx.drawImage(canvases[3], 0, 0);
        if (self2.scene.colorMode == "default") {
          finalCtx.drawImage(canvases[0], 0, 0);
        } else {
          finalCtx.drawImage(canvasGl, 0, 0);
        }
        finalCtx.drawImage(canvases[2], 0, 0);
        finalCanvas.toBlob(function(blob) {
          (0, import_file_saver.saveAs)(blob, (self2.scene.name || "export") + ".png");
        });
      }
      exportSimulator.on("simulationComplete", onSimulationEnd);
      exportSimulator.on("simulationStop", onSimulationEnd);
      exportSimulator.updateSimulation();
    });
  }
  /**
   * Require a delayed validation of the scene. The actual validation will be performed if the user is inactive for a while.
   */
  requireDelayedValidation() {
    if (this.scene.error) {
      return;
    }
    if (this.delayedValidationTimerId) {
      clearTimeout(this.delayedValidationTimerId);
    }
    const self2 = this;
    this.delayedValidationTimerId = setTimeout(function() {
      self2.validateDelayed();
    }, this.scene.warning ? 500 : 5e3);
  }
  /**
   * Perform the delayed validation of the scene. Called after the user has been inactive for a while.
   */
  validateDelayed() {
    this.scene.validateDelayed();
    this.emit("requestUpdateErrorAndWarning");
  }
  /**
   * Determines if an object should be highlighted in the scene.
   * @param {number} objIndex - The index of the object to check.
   * @returns {boolean} - Whether the object should be highlighted.
   */
  isObjHighlighted(objIndex) {
    const isCreatingHandle = this.scene.objs.length > 0 && this.scene.objs[0].constructor.type === "Handle" && this.scene.objs[0].notDone;
    if (isCreatingHandle) {
      const handle = this.scene.objs[0];
      if (handle.objIndices.includes(objIndex)) {
        return true;
      }
    }
    if (this.externalHighlightIndices.includes(objIndex)) {
      return true;
    }
    if (this.externalHoverIndex === objIndex) {
      return true;
    }
    if (!this.scene.objs[this.hoveredObjIndex]) {
      return false;
    }
    if (this.scene.objs[this.hoveredObjIndex].constructor.type === "Handle") {
      return this.scene.objs[this.hoveredObjIndex].objIndices.includes(objIndex) || this.hoveredObjIndex === objIndex;
    } else {
      return this.hoveredObjIndex === objIndex;
    }
  }
  /**
   * Set an external hover index for highlighting from UI.
   * @param {number} index - The index to highlight, or -1 to clear.
   */
  setExternalHoverIndex(index) {
    this.externalHoverIndex = Number.isInteger(index) ? index : -1;
  }
  /**
   * Set external highlight indices for multi-selection highlighting.
   * @param {number[]} indices - The indices to highlight.
   */
  setExternalHighlightIndices(indices) {
    if (!Array.isArray(indices)) {
      this.externalHighlightIndices = [];
      return;
    }
    this.externalHighlightIndices = indices.filter((index) => Number.isInteger(index));
  }
  /**
   * Set external highlight points (scene coordinates) for UI-driven preview.
   * @param {Array.<{x: number, y: number}>} points
   */
  setExternalHighlightPoints(points) {
    if (!Array.isArray(points)) {
      this.externalHighlightPoints = [];
      return;
    }
    this.externalHighlightPoints = points.filter(
      (p) => p && typeof p === "object" && typeof p.x === "number" && typeof p.y === "number" && Number.isFinite(p.x) && Number.isFinite(p.y)
    );
  }
  /**
   * Set processed primitive curve IDs for UI-driven highlighting.
   * @param {number[]} curveIds
   */
  setExternalHighlightPrimitiveCurveIds(curveIds) {
    if (!Array.isArray(curveIds)) {
      this.externalHighlightPrimitiveCurveIds = [];
      return;
    }
    this.externalHighlightPrimitiveCurveIds = curveIds.filter(
      (curveId) => Number.isInteger(curveId) && curveId >= 0
    );
  }
  /**
   * Select all objects in the scene by creating a handle that binds to all objects.
   * If a handle is already being created, add all objects to it.
   */
  selectAll() {
    if (this.scene.objs.length === 0) {
      return;
    }
    let handleIndex = -1;
    if (this.scene.objs.length > 0 && this.scene.objs[0].constructor.type === "Handle" && this.scene.objs[0].notDone) {
      handleIndex = 0;
    } else {
      this.scene.unshiftObj(new Handle2(this.scene, { notDone: true, transformation: "xTranslation" }));
      if (this.selectedObjIndex >= 0) this.selectedObjIndex++;
      this.selectObj(-1);
      handleIndex = 0;
      if (this.selectedObjIndex >= 0) {
        this.selectedObjIndex++;
      }
    }
    this.scene.objs[handleIndex].objIndices = [];
    for (let i = 0; i < this.scene.objs.length; i++) {
      if (this.scene.objs[i].constructor.type !== "Handle") {
        this.scene.objs[handleIndex].addObject(i);
      }
    }
    this.simulator.updateSimulation(true, true);
  }
  /**
   * Start long press detection for touch events.
   * @param {TouchEvent} e - The touch event.
   */
  startLongPress(e) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    this.longPressTouchPos = { x: touch.pageX, y: touch.pageY };
    this.longPressTriggered = false;
    const self2 = this;
    this.longPressTimer = setTimeout(function() {
      self2.triggerLongPress(e);
    }, this.longPressDuration);
  }
  /**
   * Cancel the long press timer.
   */
  cancelLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressTouchPos = null;
  }
  /**
   * Trigger long press action (simulates right-click behavior).
   * @param {TouchEvent} originalEvent - The original touch event.
   */
  triggerLongPress(originalEvent) {
    this.longPressTimer = null;
    this.longPressTriggered = true;
    if (!this.longPressTouchPos) return;
    const touch = originalEvent.touches[0];
    const syntheticEvent = {
      pageX: touch.pageX,
      pageY: touch.pageY,
      target: originalEvent.target,
      which: 3,
      // Right mouse button
      ctrlKey: this.virtualCtrlKey,
      shiftKey: this.virtualShiftKey,
      altKey: false,
      preventDefault: function() {
      },
      stopPropagation: function() {
      }
    };
    if (this.draggingObjIndex != -1) {
      this.draggingObjIndex = -1;
      this.dragContext = {};
    }
    this.onCanvasDblClick(syntheticEvent);
    this.longPressTouchPos = null;
  }
};
var Editor_default = Editor;

// app/notices/ray-optics/source/index.js
init_sceneObjs();
export {
  Editor_default as Editor,
  Scene_default as Scene,
  Simulator_default as Simulator,
  sceneObjs_exports as sceneObjs
};
/*! Bundled license information:

canvas2svg/canvas2svg.js:
  (*!!
   *  Canvas 2 Svg v1.0.15
   *  A low level canvas to SVG converter. Uses a mock canvas context to build an SVG document.
   *
   *  Licensed under the MIT license:
   *  http://www.opensource.org/licenses/mit-license.php
   *
   *  Author:
   *  Kerry Liu
   *
   *  Copyright (c) 2014 Gliffy Inc.
   *)

escape-html/index.js:
  (*!
   * escape-html
   * Copyright(c) 2012-2013 TJ Holowaychuk
   * Copyright(c) 2015 Andreas Lubbe
   * Copyright(c) 2015 Tiancheng "Timothy" Gu
   * MIT Licensed
   *)
*/
