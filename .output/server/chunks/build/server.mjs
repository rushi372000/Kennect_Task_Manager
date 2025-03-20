import { shallowReactive, reactive, effectScope, getCurrentScope, hasInjectionContext, getCurrentInstance, inject, toRef, computed, defineComponent, h, isReadonly, isRef, isShallow, isReactive, toRaw, ref, mergeProps, useSSRContext, resolveDirective, defineAsyncComponent, unref, provide, onErrorCaptured, onServerPrefetch, createVNode, resolveDynamicComponent, createApp } from 'vue';
import { k as createHooks, l as getContext, m as hasProtocol, n as joinURL, w as withQuery, o as sanitizeStatusCode, p as isScriptProtocol, h as createError$1, q as toRouteMatcher, r as createRouter, v as defu, x as isEqual, y as stringifyParsedURL, z as stringifyQuery, A as parseQuery } from '../_/nitro.mjs';
import { shouldHydrate, createPinia, setActivePinia, defineStore } from 'pinia';
import { ssrRenderAttrs, ssrRenderAttr, ssrIncludeBooleanAttr, ssrLooseContain, ssrLooseEqual, ssrRenderClass, ssrInterpolate, ssrGetDirectiveProps, ssrRenderComponent, ssrRenderList, ssrRenderSuspense, ssrRenderVNode } from 'vue/server-renderer';

const nuxtLinkDefaults = { "componentName": "NuxtLink" };
const appId = "nuxt-app";

function getNuxtAppCtx(id = appId) {
  return getContext(id, {
    asyncContext: false
  });
}
const NuxtPluginIndicator = "__nuxt_plugin";
function createNuxtApp(options) {
  var _a;
  let hydratingCount = 0;
  const nuxtApp = {
    _id: options.id || appId || "nuxt-app",
    _scope: effectScope(),
    provide: void 0,
    globalName: "nuxt",
    versions: {
      get nuxt() {
        return "3.16.0";
      },
      get vue() {
        return nuxtApp.vueApp.version;
      }
    },
    payload: shallowReactive({
      ...((_a = options.ssrContext) == null ? void 0 : _a.payload) || {},
      data: shallowReactive({}),
      state: reactive({}),
      once: /* @__PURE__ */ new Set(),
      _errors: shallowReactive({})
    }),
    static: {
      data: {}
    },
    runWithContext(fn) {
      if (nuxtApp._scope.active && !getCurrentScope()) {
        return nuxtApp._scope.run(() => callWithNuxt(nuxtApp, fn));
      }
      return callWithNuxt(nuxtApp, fn);
    },
    isHydrating: false,
    deferHydration() {
      if (!nuxtApp.isHydrating) {
        return () => {
        };
      }
      hydratingCount++;
      let called = false;
      return () => {
        if (called) {
          return;
        }
        called = true;
        hydratingCount--;
        if (hydratingCount === 0) {
          nuxtApp.isHydrating = false;
          return nuxtApp.callHook("app:suspense:resolve");
        }
      };
    },
    _asyncDataPromises: {},
    _asyncData: shallowReactive({}),
    _payloadRevivers: {},
    ...options
  };
  {
    nuxtApp.payload.serverRendered = true;
  }
  if (nuxtApp.ssrContext) {
    nuxtApp.payload.path = nuxtApp.ssrContext.url;
    nuxtApp.ssrContext.nuxt = nuxtApp;
    nuxtApp.ssrContext.payload = nuxtApp.payload;
    nuxtApp.ssrContext.config = {
      public: nuxtApp.ssrContext.runtimeConfig.public,
      app: nuxtApp.ssrContext.runtimeConfig.app
    };
  }
  nuxtApp.hooks = createHooks();
  nuxtApp.hook = nuxtApp.hooks.hook;
  {
    const contextCaller = async function(hooks, args) {
      for (const hook of hooks) {
        await nuxtApp.runWithContext(() => hook(...args));
      }
    };
    nuxtApp.hooks.callHook = (name, ...args) => nuxtApp.hooks.callHookWith(contextCaller, name, ...args);
  }
  nuxtApp.callHook = nuxtApp.hooks.callHook;
  nuxtApp.provide = (name, value) => {
    const $name = "$" + name;
    defineGetter(nuxtApp, $name, value);
    defineGetter(nuxtApp.vueApp.config.globalProperties, $name, value);
  };
  defineGetter(nuxtApp.vueApp, "$nuxt", nuxtApp);
  defineGetter(nuxtApp.vueApp.config.globalProperties, "$nuxt", nuxtApp);
  const runtimeConfig = options.ssrContext.runtimeConfig;
  nuxtApp.provide("config", runtimeConfig);
  return nuxtApp;
}
function registerPluginHooks(nuxtApp, plugin) {
  if (plugin.hooks) {
    nuxtApp.hooks.addHooks(plugin.hooks);
  }
}
async function applyPlugin(nuxtApp, plugin) {
  if (typeof plugin === "function") {
    const { provide } = await nuxtApp.runWithContext(() => plugin(nuxtApp)) || {};
    if (provide && typeof provide === "object") {
      for (const key in provide) {
        nuxtApp.provide(key, provide[key]);
      }
    }
  }
}
async function applyPlugins(nuxtApp, plugins) {
  var _a, _b, _c, _d;
  const resolvedPlugins = [];
  const unresolvedPlugins = [];
  const parallels = [];
  const errors = [];
  let promiseDepth = 0;
  async function executePlugin(plugin) {
    var _a2;
    const unresolvedPluginsForThisPlugin = ((_a2 = plugin.dependsOn) == null ? void 0 : _a2.filter((name) => plugins.some((p) => p._name === name) && !resolvedPlugins.includes(name))) ?? [];
    if (unresolvedPluginsForThisPlugin.length > 0) {
      unresolvedPlugins.push([new Set(unresolvedPluginsForThisPlugin), plugin]);
    } else {
      const promise = applyPlugin(nuxtApp, plugin).then(async () => {
        if (plugin._name) {
          resolvedPlugins.push(plugin._name);
          await Promise.all(unresolvedPlugins.map(async ([dependsOn, unexecutedPlugin]) => {
            if (dependsOn.has(plugin._name)) {
              dependsOn.delete(plugin._name);
              if (dependsOn.size === 0) {
                promiseDepth++;
                await executePlugin(unexecutedPlugin);
              }
            }
          }));
        }
      });
      if (plugin.parallel) {
        parallels.push(promise.catch((e) => errors.push(e)));
      } else {
        await promise;
      }
    }
  }
  for (const plugin of plugins) {
    if (((_a = nuxtApp.ssrContext) == null ? void 0 : _a.islandContext) && ((_b = plugin.env) == null ? void 0 : _b.islands) === false) {
      continue;
    }
    registerPluginHooks(nuxtApp, plugin);
  }
  for (const plugin of plugins) {
    if (((_c = nuxtApp.ssrContext) == null ? void 0 : _c.islandContext) && ((_d = plugin.env) == null ? void 0 : _d.islands) === false) {
      continue;
    }
    await executePlugin(plugin);
  }
  await Promise.all(parallels);
  if (promiseDepth) {
    for (let i = 0; i < promiseDepth; i++) {
      await Promise.all(parallels);
    }
  }
  if (errors.length) {
    throw errors[0];
  }
}
// @__NO_SIDE_EFFECTS__
function defineNuxtPlugin(plugin) {
  if (typeof plugin === "function") {
    return plugin;
  }
  const _name = plugin._name || plugin.name;
  delete plugin.name;
  return Object.assign(plugin.setup || (() => {
  }), plugin, { [NuxtPluginIndicator]: true, _name });
}
const definePayloadPlugin = defineNuxtPlugin;
function callWithNuxt(nuxt, setup, args) {
  const fn = () => setup();
  const nuxtAppCtx = getNuxtAppCtx(nuxt._id);
  {
    return nuxt.vueApp.runWithContext(() => nuxtAppCtx.callAsync(nuxt, fn));
  }
}
function tryUseNuxtApp(id) {
  var _a;
  let nuxtAppInstance;
  if (hasInjectionContext()) {
    nuxtAppInstance = (_a = getCurrentInstance()) == null ? void 0 : _a.appContext.app.$nuxt;
  }
  nuxtAppInstance || (nuxtAppInstance = getNuxtAppCtx(id).tryUse());
  return nuxtAppInstance || null;
}
function useNuxtApp(id) {
  const nuxtAppInstance = tryUseNuxtApp(id);
  if (!nuxtAppInstance) {
    {
      throw new Error("[nuxt] instance unavailable");
    }
  }
  return nuxtAppInstance;
}
// @__NO_SIDE_EFFECTS__
function useRuntimeConfig(_event) {
  return useNuxtApp().$config;
}
function defineGetter(obj, key, val) {
  Object.defineProperty(obj, key, { get: () => val });
}

const PageRouteSymbol = Symbol("route");

const useRouter = () => {
  var _a;
  return (_a = useNuxtApp()) == null ? void 0 : _a.$router;
};
const useRoute = () => {
  if (hasInjectionContext()) {
    return inject(PageRouteSymbol, useNuxtApp()._route);
  }
  return useNuxtApp()._route;
};
// @__NO_SIDE_EFFECTS__
function defineNuxtRouteMiddleware(middleware) {
  return middleware;
}
const isProcessingMiddleware = () => {
  try {
    if (useNuxtApp()._processingMiddleware) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
};
const URL_QUOTE_RE = /"/g;
const navigateTo = (to, options) => {
  to || (to = "/");
  const toPath = typeof to === "string" ? to : "path" in to ? resolveRouteObject(to) : useRouter().resolve(to).href;
  const isExternalHost = hasProtocol(toPath, { acceptRelative: true });
  const isExternal = (options == null ? void 0 : options.external) || isExternalHost;
  if (isExternal) {
    if (!(options == null ? void 0 : options.external)) {
      throw new Error("Navigating to an external URL is not allowed by default. Use `navigateTo(url, { external: true })`.");
    }
    const { protocol } = new URL(toPath, "http://localhost");
    if (protocol && isScriptProtocol(protocol)) {
      throw new Error(`Cannot navigate to a URL with '${protocol}' protocol.`);
    }
  }
  const inMiddleware = isProcessingMiddleware();
  const router = useRouter();
  const nuxtApp = useNuxtApp();
  {
    if (nuxtApp.ssrContext) {
      const fullPath = typeof to === "string" || isExternal ? toPath : router.resolve(to).fullPath || "/";
      const location2 = isExternal ? toPath : joinURL(useRuntimeConfig().app.baseURL, fullPath);
      const redirect = async function(response) {
        await nuxtApp.callHook("app:redirected");
        const encodedLoc = location2.replace(URL_QUOTE_RE, "%22");
        const encodedHeader = encodeURL(location2, isExternalHost);
        nuxtApp.ssrContext._renderResponse = {
          statusCode: sanitizeStatusCode((options == null ? void 0 : options.redirectCode) || 302, 302),
          body: `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encodedLoc}"></head></html>`,
          headers: { location: encodedHeader }
        };
        return response;
      };
      if (!isExternal && inMiddleware) {
        router.afterEach((final) => final.fullPath === fullPath ? redirect(false) : void 0);
        return to;
      }
      return redirect(!inMiddleware ? void 0 : (
        /* abort route navigation */
        false
      ));
    }
  }
  if (isExternal) {
    nuxtApp._scope.stop();
    if (options == null ? void 0 : options.replace) {
      (void 0).replace(toPath);
    } else {
      (void 0).href = toPath;
    }
    if (inMiddleware) {
      if (!nuxtApp.isHydrating) {
        return false;
      }
      return new Promise(() => {
      });
    }
    return Promise.resolve();
  }
  return (options == null ? void 0 : options.replace) ? router.replace(to) : router.push(to);
};
function resolveRouteObject(to) {
  return withQuery(to.path || "", to.query || {}) + (to.hash || "");
}
function encodeURL(location2, isExternalHost = false) {
  const url = new URL(location2, "http://localhost");
  if (!isExternalHost) {
    return url.pathname + url.search + url.hash;
  }
  if (location2.startsWith("//")) {
    return url.toString().replace(url.protocol, "");
  }
  return url.toString();
}

const NUXT_ERROR_SIGNATURE = "__nuxt_error";
const useError = () => toRef(useNuxtApp().payload, "error");
const showError = (error) => {
  const nuxtError = createError(error);
  try {
    const nuxtApp = useNuxtApp();
    const error2 = useError();
    if (false) ;
    error2.value || (error2.value = nuxtError);
  } catch {
    throw nuxtError;
  }
  return nuxtError;
};
const isNuxtError = (error) => !!error && typeof error === "object" && NUXT_ERROR_SIGNATURE in error;
const createError = (error) => {
  const nuxtError = createError$1(error);
  Object.defineProperty(nuxtError, NUXT_ERROR_SIGNATURE, {
    value: true,
    configurable: false,
    writable: false
  });
  return nuxtError;
};

function definePayloadReducer(name, reduce) {
  {
    useNuxtApp().ssrContext._payloadReducers[name] = reduce;
  }
}

const payloadPlugin = definePayloadPlugin(() => {
  definePayloadReducer(
    "skipHydrate",
    // We need to return something truthy to be treated as a match
    (data) => !shouldHydrate(data) && 1
  );
});

const unhead_k2P3m_ZDyjlr2mMYnoDPwavjsDN8hBlk9cFai0bbopU = defineNuxtPlugin({
  name: "nuxt:head",
  enforce: "pre",
  setup(nuxtApp) {
    const head = nuxtApp.ssrContext.head;
    nuxtApp.vueApp.use(head);
  }
});

async function getRouteRules(arg) {
  const path = typeof arg === "string" ? arg : arg.path;
  {
    useNuxtApp().ssrContext._preloadManifest = true;
    const _routeRulesMatcher = toRouteMatcher(
      createRouter({ routes: useRuntimeConfig().nitro.routeRules })
    );
    return defu({}, ..._routeRulesMatcher.matchAll(path).reverse());
  }
}

const manifest_45route_45rule = defineNuxtRouteMiddleware(async (to) => {
  {
    return;
  }
});

const globalMiddleware = [
  manifest_45route_45rule
];

function getRouteFromPath(fullPath) {
  if (typeof fullPath === "object") {
    fullPath = stringifyParsedURL({
      pathname: fullPath.path || "",
      search: stringifyQuery(fullPath.query || {}),
      hash: fullPath.hash || ""
    });
  }
  const url = new URL(fullPath.toString(), "http://localhost");
  return {
    path: url.pathname,
    fullPath,
    query: parseQuery(url.search),
    hash: url.hash,
    // stub properties for compat with vue-router
    params: {},
    name: void 0,
    matched: [],
    redirectedFrom: void 0,
    meta: {},
    href: fullPath
  };
}
const router_DclsWNDeVV7SyG4lslgLnjbQUK1ws8wgf2FHaAbo7Cw = defineNuxtPlugin({
  name: "nuxt:router",
  enforce: "pre",
  setup(nuxtApp) {
    const initialURL = nuxtApp.ssrContext.url;
    const routes = [];
    const hooks = {
      "navigate:before": [],
      "resolve:before": [],
      "navigate:after": [],
      "error": []
    };
    const registerHook = (hook, guard) => {
      hooks[hook].push(guard);
      return () => hooks[hook].splice(hooks[hook].indexOf(guard), 1);
    };
    useRuntimeConfig().app.baseURL;
    const route = reactive(getRouteFromPath(initialURL));
    async function handleNavigation(url, replace) {
      try {
        const to = getRouteFromPath(url);
        for (const middleware of hooks["navigate:before"]) {
          const result = await middleware(to, route);
          if (result === false || result instanceof Error) {
            return;
          }
          if (typeof result === "string" && result.length) {
            return handleNavigation(result, true);
          }
        }
        for (const handler of hooks["resolve:before"]) {
          await handler(to, route);
        }
        Object.assign(route, to);
        if (false) ;
        for (const middleware of hooks["navigate:after"]) {
          await middleware(to, route);
        }
      } catch (err) {
        for (const handler of hooks.error) {
          await handler(err);
        }
      }
    }
    const currentRoute = computed(() => route);
    const router = {
      currentRoute,
      isReady: () => Promise.resolve(),
      // These options provide a similar API to vue-router but have no effect
      options: {},
      install: () => Promise.resolve(),
      // Navigation
      push: (url) => handleNavigation(url),
      replace: (url) => handleNavigation(url),
      back: () => (void 0).history.go(-1),
      go: (delta) => (void 0).history.go(delta),
      forward: () => (void 0).history.go(1),
      // Guards
      beforeResolve: (guard) => registerHook("resolve:before", guard),
      beforeEach: (guard) => registerHook("navigate:before", guard),
      afterEach: (guard) => registerHook("navigate:after", guard),
      onError: (handler) => registerHook("error", handler),
      // Routes
      resolve: getRouteFromPath,
      addRoute: (parentName, route2) => {
        routes.push(route2);
      },
      getRoutes: () => routes,
      hasRoute: (name) => routes.some((route2) => route2.name === name),
      removeRoute: (name) => {
        const index = routes.findIndex((route2) => route2.name === name);
        if (index !== -1) {
          routes.splice(index, 1);
        }
      }
    };
    nuxtApp.vueApp.component("RouterLink", defineComponent({
      functional: true,
      props: {
        to: {
          type: String,
          required: true
        },
        custom: Boolean,
        replace: Boolean,
        // Not implemented
        activeClass: String,
        exactActiveClass: String,
        ariaCurrentValue: String
      },
      setup: (props, { slots }) => {
        const navigate = () => handleNavigation(props.to, props.replace);
        return () => {
          var _a;
          const route2 = router.resolve(props.to);
          return props.custom ? (_a = slots.default) == null ? void 0 : _a.call(slots, { href: props.to, navigate, route: route2 }) : h("a", { href: props.to, onClick: (e) => {
            e.preventDefault();
            return navigate();
          } }, slots);
        };
      }
    }));
    nuxtApp._route = route;
    nuxtApp._middleware || (nuxtApp._middleware = {
      global: [],
      named: {}
    });
    const initialLayout = nuxtApp.payload.state._layout;
    nuxtApp.hooks.hookOnce("app:created", async () => {
      router.beforeEach(async (to, from) => {
        var _a;
        to.meta = reactive(to.meta || {});
        if (nuxtApp.isHydrating && initialLayout && !isReadonly(to.meta.layout)) {
          to.meta.layout = initialLayout;
        }
        nuxtApp._processingMiddleware = true;
        if (!((_a = nuxtApp.ssrContext) == null ? void 0 : _a.islandContext)) {
          const middlewareEntries = /* @__PURE__ */ new Set([...globalMiddleware, ...nuxtApp._middleware.global]);
          {
            const routeRules = await nuxtApp.runWithContext(() => getRouteRules({ path: to.path }));
            if (routeRules.appMiddleware) {
              for (const key in routeRules.appMiddleware) {
                const guard = nuxtApp._middleware.named[key];
                if (!guard) {
                  return;
                }
                if (routeRules.appMiddleware[key]) {
                  middlewareEntries.add(guard);
                } else {
                  middlewareEntries.delete(guard);
                }
              }
            }
          }
          for (const middleware of middlewareEntries) {
            const result = await nuxtApp.runWithContext(() => middleware(to, from));
            {
              if (result === false || result instanceof Error) {
                const error = result || createError$1({
                  statusCode: 404,
                  statusMessage: `Page Not Found: ${initialURL}`,
                  data: {
                    path: initialURL
                  }
                });
                delete nuxtApp._processingMiddleware;
                return nuxtApp.runWithContext(() => showError(error));
              }
            }
            if (result === true) {
              continue;
            }
            if (result || result === false) {
              return result;
            }
          }
        }
      });
      router.afterEach(() => {
        delete nuxtApp._processingMiddleware;
      });
      await router.replace(initialURL);
      if (!isEqual(route.fullPath, initialURL)) {
        await nuxtApp.runWithContext(() => navigateTo(route.fullPath));
      }
    });
    return {
      provide: {
        route,
        router
      }
    };
  }
});

const reducers = [
  ["NuxtError", (data) => isNuxtError(data) && data.toJSON()],
  ["EmptyShallowRef", (data) => isRef(data) && isShallow(data) && !data.value && (typeof data.value === "bigint" ? "0n" : JSON.stringify(data.value) || "_")],
  ["EmptyRef", (data) => isRef(data) && !data.value && (typeof data.value === "bigint" ? "0n" : JSON.stringify(data.value) || "_")],
  ["ShallowRef", (data) => isRef(data) && isShallow(data) && data.value],
  ["ShallowReactive", (data) => isReactive(data) && isShallow(data) && toRaw(data)],
  ["Ref", (data) => isRef(data) && data.value],
  ["Reactive", (data) => isReactive(data) && toRaw(data)]
];
const revive_payload_server_MVtmlZaQpj6ApFmshWfUWl5PehCebzaBf2NuRMiIbms = defineNuxtPlugin({
  name: "nuxt:revive-payload:server",
  setup() {
    for (const [reducer, fn] of reducers) {
      definePayloadReducer(reducer, fn);
    }
  }
});

const plugin = defineNuxtPlugin({
  name: "pinia",
  setup(nuxtApp) {
    const pinia = createPinia();
    nuxtApp.vueApp.use(pinia);
    setActivePinia(pinia);
    {
      nuxtApp.payload.pinia = toRaw(pinia.state.value);
    }
    return {
      provide: {
        pinia
      }
    };
  }
});

const components_plugin_z4hgvsiddfKkfXTP6M8M4zG5Cb7sGnDhcryKVM45Di4 = defineNuxtPlugin({
  name: "nuxt:global-components"
});

const plugins = [
  payloadPlugin,
  unhead_k2P3m_ZDyjlr2mMYnoDPwavjsDN8hBlk9cFai0bbopU,
  router_DclsWNDeVV7SyG4lslgLnjbQUK1ws8wgf2FHaAbo7Cw,
  revive_payload_server_MVtmlZaQpj6ApFmshWfUWl5PehCebzaBf2NuRMiIbms,
  plugin,
  components_plugin_z4hgvsiddfKkfXTP6M8M4zG5Cb7sGnDhcryKVM45Di4
];

const useTaskStore = defineStore("tasks", {
  state: () => {
    return {
      tasks: [],
      filters: {
        status: "All",
        priority: "All"
      }
    };
  },
  getters: {
    filteredTasks: (state) => {
      return state.tasks.filter((task) => {
        const statusMatch = state.filters.status === "All" || task.status === state.filters.status;
        const priorityMatch = state.filters.priority === "All" || task.priority === state.filters.priority;
        return statusMatch && priorityMatch;
      });
    }
  },
  actions: {
    addTask(task) {
      this.tasks.push({
        id: Date.now(),
        name: task.name,
        priority: task.priority,
        status: task.status || "Pending"
      });
      this.saveTasks();
    },
    toggleTaskStatus(taskId) {
      const task = this.tasks.find((t) => t.id === taskId);
      if (task) {
        task.status = task.status === "Pending" ? "Completed" : "Pending";
        this.saveTasks();
      }
    },
    updateFilters(filters) {
      this.filters = { ...this.filters, ...filters };
      this.saveFilters();
    },
    editTask(taskId, updatedTask) {
      const index = this.tasks.findIndex((t) => t.id === taskId);
      if (index !== -1) {
        this.tasks[index] = { ...this.tasks[index], ...updatedTask };
        this.saveTasks();
      }
    },
    deleteTask(taskId) {
      this.tasks = this.tasks.filter((t) => t.id !== taskId);
      this.saveTasks();
    },
    saveTasks() {
    },
    saveFilters() {
    }
  }
});

const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};

const _sfc_main$6 = {
  __name: "TaskForm",
  __ssrInlineRender: true,
  setup(__props) {
    useTaskStore();
    const newTask = ref({
      name: "",
      priority: "Medium",
      status: "Pending"
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "task-form" }, _attrs))} data-v-9ff2dfa0><h2 data-v-9ff2dfa0>Add New Task</h2><form data-v-9ff2dfa0><div class="form-group" data-v-9ff2dfa0><label for="task-name" data-v-9ff2dfa0>Task Name:</label><input id="task-name"${ssrRenderAttr("value", newTask.value.name)} type="text" required placeholder="Enter task name" data-v-9ff2dfa0></div><div class="form-group" data-v-9ff2dfa0><label for="task-priority" data-v-9ff2dfa0>Priority:</label><select id="task-priority" data-v-9ff2dfa0><option value="High" data-v-9ff2dfa0${ssrIncludeBooleanAttr(Array.isArray(newTask.value.priority) ? ssrLooseContain(newTask.value.priority, "High") : ssrLooseEqual(newTask.value.priority, "High")) ? " selected" : ""}>High</option><option value="Medium" data-v-9ff2dfa0${ssrIncludeBooleanAttr(Array.isArray(newTask.value.priority) ? ssrLooseContain(newTask.value.priority, "Medium") : ssrLooseEqual(newTask.value.priority, "Medium")) ? " selected" : ""}>Medium</option><option value="Low" data-v-9ff2dfa0${ssrIncludeBooleanAttr(Array.isArray(newTask.value.priority) ? ssrLooseContain(newTask.value.priority, "Low") : ssrLooseEqual(newTask.value.priority, "Low")) ? " selected" : ""}>Low</option></select></div><div class="form-group" data-v-9ff2dfa0><label for="task-status" data-v-9ff2dfa0>Status:</label><select id="task-status" data-v-9ff2dfa0><option value="Pending" data-v-9ff2dfa0${ssrIncludeBooleanAttr(Array.isArray(newTask.value.status) ? ssrLooseContain(newTask.value.status, "Pending") : ssrLooseEqual(newTask.value.status, "Pending")) ? " selected" : ""}>Pending</option><option value="Completed" data-v-9ff2dfa0${ssrIncludeBooleanAttr(Array.isArray(newTask.value.status) ? ssrLooseContain(newTask.value.status, "Completed") : ssrLooseEqual(newTask.value.status, "Completed")) ? " selected" : ""}>Completed</option></select></div><button type="submit" data-v-9ff2dfa0>Add Task</button></form></div>`);
    };
  }
};
const _sfc_setup$6 = _sfc_main$6.setup;
_sfc_main$6.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/TaskForm.vue");
  return _sfc_setup$6 ? _sfc_setup$6(props, ctx) : void 0;
};
const TaskForm = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["__scopeId", "data-v-9ff2dfa0"]]);

const _sfc_main$5 = {
  __name: "TaskItem",
  __ssrInlineRender: true,
  props: {
    task: {
      type: Object,
      required: true
    }
  },
  setup(__props) {
    useTaskStore();
    const editing = ref(false);
    const editedTask = reactive({
      name: "",
      priority: "",
      status: ""
    });
    return (_ctx, _push, _parent, _attrs) => {
      const _directive_priority = resolveDirective("priority");
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "task-item" }, _attrs, ssrGetDirectiveProps(_ctx, _directive_priority, __props.task.priority)))} data-v-d16f0430><div class="task-content" data-v-d16f0430><h3 class="${ssrRenderClass({ "completed": __props.task.status === "Completed" })}" data-v-d16f0430>${ssrInterpolate(__props.task.name)}</h3><div class="task-details" data-v-d16f0430><span class="priority" data-v-d16f0430>Priority: ${ssrInterpolate(__props.task.priority)}</span><span class="status" data-v-d16f0430>Status: ${ssrInterpolate(__props.task.status)}</span></div></div><div class="task-actions" data-v-d16f0430><button class="toggle-btn" data-v-d16f0430>${ssrInterpolate(__props.task.status === "Pending" ? "Mark Complete" : "Mark Pending")}</button>`);
      if (!editing.value) {
        _push(`<button class="edit-btn" data-v-d16f0430> Edit </button>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<button class="delete-btn" data-v-d16f0430> Delete </button></div>`);
      if (editing.value) {
        _push(`<div class="edit-form" data-v-d16f0430><input${ssrRenderAttr("value", editedTask.name)} type="text" data-v-d16f0430><select data-v-d16f0430><option value="High" data-v-d16f0430${ssrIncludeBooleanAttr(Array.isArray(editedTask.priority) ? ssrLooseContain(editedTask.priority, "High") : ssrLooseEqual(editedTask.priority, "High")) ? " selected" : ""}>High</option><option value="Medium" data-v-d16f0430${ssrIncludeBooleanAttr(Array.isArray(editedTask.priority) ? ssrLooseContain(editedTask.priority, "Medium") : ssrLooseEqual(editedTask.priority, "Medium")) ? " selected" : ""}>Medium</option><option value="Low" data-v-d16f0430${ssrIncludeBooleanAttr(Array.isArray(editedTask.priority) ? ssrLooseContain(editedTask.priority, "Low") : ssrLooseEqual(editedTask.priority, "Low")) ? " selected" : ""}>Low</option></select><select data-v-d16f0430><option value="Pending" data-v-d16f0430${ssrIncludeBooleanAttr(Array.isArray(editedTask.status) ? ssrLooseContain(editedTask.status, "Pending") : ssrLooseEqual(editedTask.status, "Pending")) ? " selected" : ""}>Pending</option><option value="Completed" data-v-d16f0430${ssrIncludeBooleanAttr(Array.isArray(editedTask.status) ? ssrLooseContain(editedTask.status, "Completed") : ssrLooseEqual(editedTask.status, "Completed")) ? " selected" : ""}>Completed</option></select><div class="edit-actions" data-v-d16f0430><button data-v-d16f0430>Save</button><button data-v-d16f0430>Cancel</button></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
};
const _sfc_setup$5 = _sfc_main$5.setup;
_sfc_main$5.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/TaskItem.vue");
  return _sfc_setup$5 ? _sfc_setup$5(props, ctx) : void 0;
};
const TaskItem = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["__scopeId", "data-v-d16f0430"]]);

const _sfc_main$4 = {
  __name: "TaskFilters",
  __ssrInlineRender: true,
  setup(__props) {
    useTaskStore();
    const filters = reactive({
      status: "All",
      priority: "All"
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "task-filters" }, _attrs))} data-v-b8eb7b84><div class="filter-group" data-v-b8eb7b84><label for="status-filter" data-v-b8eb7b84>Status:</label><select id="status-filter" data-v-b8eb7b84><option value="All" data-v-b8eb7b84${ssrIncludeBooleanAttr(Array.isArray(filters.status) ? ssrLooseContain(filters.status, "All") : ssrLooseEqual(filters.status, "All")) ? " selected" : ""}>All</option><option value="Pending" data-v-b8eb7b84${ssrIncludeBooleanAttr(Array.isArray(filters.status) ? ssrLooseContain(filters.status, "Pending") : ssrLooseEqual(filters.status, "Pending")) ? " selected" : ""}>Pending</option><option value="Completed" data-v-b8eb7b84${ssrIncludeBooleanAttr(Array.isArray(filters.status) ? ssrLooseContain(filters.status, "Completed") : ssrLooseEqual(filters.status, "Completed")) ? " selected" : ""}>Completed</option></select></div><div class="filter-group" data-v-b8eb7b84><label for="priority-filter" data-v-b8eb7b84>Priority:</label><select id="priority-filter" data-v-b8eb7b84><option value="All" data-v-b8eb7b84${ssrIncludeBooleanAttr(Array.isArray(filters.priority) ? ssrLooseContain(filters.priority, "All") : ssrLooseEqual(filters.priority, "All")) ? " selected" : ""}>All</option><option value="High" data-v-b8eb7b84${ssrIncludeBooleanAttr(Array.isArray(filters.priority) ? ssrLooseContain(filters.priority, "High") : ssrLooseEqual(filters.priority, "High")) ? " selected" : ""}>High</option><option value="Medium" data-v-b8eb7b84${ssrIncludeBooleanAttr(Array.isArray(filters.priority) ? ssrLooseContain(filters.priority, "Medium") : ssrLooseEqual(filters.priority, "Medium")) ? " selected" : ""}>Medium</option><option value="Low" data-v-b8eb7b84${ssrIncludeBooleanAttr(Array.isArray(filters.priority) ? ssrLooseContain(filters.priority, "Low") : ssrLooseEqual(filters.priority, "Low")) ? " selected" : ""}>Low</option></select></div></div>`);
    };
  }
};
const _sfc_setup$4 = _sfc_main$4.setup;
_sfc_main$4.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/TaskFilters.vue");
  return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
const TaskFilters = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__scopeId", "data-v-b8eb7b84"]]);

const _sfc_main$3 = {
  __name: "TaskList",
  __ssrInlineRender: true,
  setup(__props) {
    const taskStore = useTaskStore();
    const filteredTasks = computed(() => taskStore.filteredTasks);
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "task-list" }, _attrs))} data-v-dc22d418><h2 data-v-dc22d418>Task List</h2>`);
      _push(ssrRenderComponent(TaskFilters, null, null, _parent));
      if (filteredTasks.value.length > 0) {
        _push(`<div data-v-dc22d418><!--[-->`);
        ssrRenderList(filteredTasks.value, (task) => {
          _push(ssrRenderComponent(TaskItem, {
            key: task.id,
            task
          }, null, _parent));
        });
        _push(`<!--]--></div>`);
      } else {
        _push(`<div class="no-tasks" data-v-dc22d418> No tasks match your filters. </div>`);
      }
      _push(`</div>`);
    };
  }
};
const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/TaskList.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
const TaskList = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__scopeId", "data-v-dc22d418"]]);

/* empty css          */
const _sfc_main$2 = {
  __name: "app",
  __ssrInlineRender: true,
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "app" }, _attrs))}><h1>Simple Task Manager</h1>`);
      _push(ssrRenderComponent(TaskForm, null, null, _parent));
      _push(ssrRenderComponent(TaskList, null, null, _parent));
      _push(`</div>`);
    };
  }
};
const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("app.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};

const _sfc_main$1 = {
  __name: "nuxt-error-page",
  __ssrInlineRender: true,
  props: {
    error: Object
  },
  setup(__props) {
    const props = __props;
    const _error = props.error;
    _error.stack ? _error.stack.split("\n").splice(1).map((line) => {
      const text = line.replace("webpack:/", "").replace(".vue", ".js").trim();
      return {
        text,
        internal: line.includes("node_modules") && !line.includes(".cache") || line.includes("internal") || line.includes("new Promise")
      };
    }).map((i) => `<span class="stack${i.internal ? " internal" : ""}">${i.text}</span>`).join("\n") : "";
    const statusCode = Number(_error.statusCode || 500);
    const is404 = statusCode === 404;
    const statusMessage = _error.statusMessage ?? (is404 ? "Page Not Found" : "Internal Server Error");
    const description = _error.message || _error.toString();
    const stack = void 0;
    const _Error404 = defineAsyncComponent(() => import('./error-404.vue.mjs'));
    const _Error = defineAsyncComponent(() => import('./error-500.vue.mjs'));
    const ErrorTemplate = is404 ? _Error404 : _Error;
    return (_ctx, _push, _parent, _attrs) => {
      _push(ssrRenderComponent(unref(ErrorTemplate), mergeProps({ statusCode: unref(statusCode), statusMessage: unref(statusMessage), description: unref(description), stack: unref(stack) }, _attrs), null, _parent));
    };
  }
};
const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("node_modules/nuxt/dist/app/components/nuxt-error-page.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};

const _sfc_main = {
  __name: "nuxt-root",
  __ssrInlineRender: true,
  setup(__props) {
    const IslandRenderer = () => null;
    const nuxtApp = useNuxtApp();
    nuxtApp.deferHydration();
    nuxtApp.ssrContext.url;
    const SingleRenderer = false;
    provide(PageRouteSymbol, useRoute());
    nuxtApp.hooks.callHookWith((hooks) => hooks.map((hook) => hook()), "vue:setup");
    const error = useError();
    const abortRender = error.value && !nuxtApp.ssrContext.error;
    onErrorCaptured((err, target, info) => {
      nuxtApp.hooks.callHook("vue:error", err, target, info).catch((hookError) => console.error("[nuxt] Error in `vue:error` hook", hookError));
      {
        const p = nuxtApp.runWithContext(() => showError(err));
        onServerPrefetch(() => p);
        return false;
      }
    });
    const islandContext = nuxtApp.ssrContext.islandContext;
    return (_ctx, _push, _parent, _attrs) => {
      ssrRenderSuspense(_push, {
        default: () => {
          if (unref(abortRender)) {
            _push(`<div></div>`);
          } else if (unref(error)) {
            _push(ssrRenderComponent(unref(_sfc_main$1), { error: unref(error) }, null, _parent));
          } else if (unref(islandContext)) {
            _push(ssrRenderComponent(unref(IslandRenderer), { context: unref(islandContext) }, null, _parent));
          } else if (unref(SingleRenderer)) {
            ssrRenderVNode(_push, createVNode(resolveDynamicComponent(unref(SingleRenderer)), null, null), _parent);
          } else {
            _push(ssrRenderComponent(unref(_sfc_main$2), null, null, _parent));
          }
        },
        _: 1
      });
    };
  }
};
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("node_modules/nuxt/dist/app/components/nuxt-root.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

let entry;
{
  entry = async function createNuxtAppServer(ssrContext) {
    var _a;
    const vueApp = createApp(_sfc_main);
    const nuxt = createNuxtApp({ vueApp, ssrContext });
    try {
      await applyPlugins(nuxt, plugins);
      await nuxt.hooks.callHook("app:created", vueApp);
    } catch (error) {
      await nuxt.hooks.callHook("app:error", error);
      (_a = nuxt.payload).error || (_a.error = createError(error));
    }
    if (ssrContext == null ? void 0 : ssrContext._renderResponse) {
      throw new Error("skipping render");
    }
    return vueApp;
  };
}
const entry$1 = (ssrContext) => entry(ssrContext);

const server = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: entry$1
});

export { _export_sfc as _, useNuxtApp as a, useRuntimeConfig as b, nuxtLinkDefaults as c, navigateTo as n, resolveRouteObject as r, server as s, tryUseNuxtApp as t, useRouter as u };
//# sourceMappingURL=server.mjs.map
