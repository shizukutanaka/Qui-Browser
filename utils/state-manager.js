const EventEmitter = require('events');

/**
 * Action
 */
class Action {
  constructor(type, payload = {}, meta = {}) {
    this.type = type;
    this.payload = payload;
    this.meta = meta;
    this.timestamp = Date.now();
  }
}

/**
 * Reducer
 */
class Reducer {
  constructor(initialState = {}, handlers = {}) {
    this.initialState = initialState;
    this.handlers = handlers;
  }

  /**
   * Reduce state with action
   */
  reduce(state = this.initialState, action) {
    const handler = this.handlers[action.type];

    if (handler) {
      return handler(state, action);
    }

    return state;
  }

  /**
   * Add handler
   */
  addHandler(actionType, handler) {
    this.handlers[actionType] = handler;
    return this;
  }
}

/**
 * Middleware
 */
class Middleware {
  constructor(fn) {
    this.fn = fn;
  }

  /**
   * Execute middleware
   */
  execute(store, action, next) {
    return this.fn(store, action, next);
  }
}

/**
 * Store
 */
class Store extends EventEmitter {
  constructor(reducer, initialState, options = {}) {
    super();

    this.reducer = reducer;
    this.state = initialState !== undefined ? initialState : reducer.initialState;
    this.middlewares = [];
    this.listeners = new Set();
    this.history = [];
    this.config = {
      maxHistory: 50,
      enableDevTools: false,
      ...options
    };

    this.actionCount = 0;
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Dispatch action
   */
  dispatch(action) {
    if (typeof action === 'string') {
      action = new Action(action);
    } else if (!(action instanceof Action)) {
      action = new Action(action.type, action.payload, action.meta);
    }

    // Execute middleware chain
    const chain = [...this.middlewares];
    const execute = (index) => {
      if (index >= chain.length) {
        return this.executeDispatch(action);
      }

      return chain[index].execute(this, action, () => execute(index + 1));
    };

    return execute(0);
  }

  /**
   * Execute dispatch (after middleware)
   */
  executeDispatch(action) {
    const prevState = this.state;

    // Reduce state
    this.state = this.reducer.reduce(this.state, action);

    this.actionCount++;

    // Add to history
    if (this.config.maxHistory > 0) {
      this.history.push({
        action,
        prevState,
        nextState: this.state,
        timestamp: Date.now()
      });

      // Trim history
      if (this.history.length > this.config.maxHistory) {
        this.history.shift();
      }
    }

    // Notify listeners
    this.listeners.forEach((listener) => {
      listener(this.state, prevState, action);
    });

    this.emit('state-changed', {
      state: this.state,
      prevState,
      action
    });

    return action;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Use middleware
   */
  use(middleware) {
    if (typeof middleware === 'function') {
      middleware = new Middleware(middleware);
    }

    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Replace reducer
   */
  replaceReducer(reducer) {
    this.reducer = reducer;
    this.emit('reducer-replaced');
    return this;
  }

  /**
   * Get action history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
    return this;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      actionCount: this.actionCount,
      historySize: this.history.length,
      listenerCount: this.listeners.size,
      middlewareCount: this.middlewares.length
    };
  }
}

/**
 * Combine Reducers
 */
function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers);

  const combinedInitialState = reducerKeys.reduce((state, key) => {
    state[key] = reducers[key].initialState;
    return state;
  }, {});

  const combinedHandlers = {};

  return new Reducer(combinedInitialState, {
    ...combinedHandlers,
    '*': (state, action) => {
      return reducerKeys.reduce((nextState, key) => {
        nextState[key] = reducers[key].reduce(state[key], action);
        return nextState;
      }, {});
    }
  });
}

/**
 * Logger Middleware
 */
function loggerMiddleware(store, action, next) {
  console.log('Dispatching:', action.type);
  console.log('Prev State:', store.getState());

  const result = next();

  console.log('Next State:', store.getState());

  return result;
}

/**
 * Thunk Middleware
 */
function thunkMiddleware(store, action, next) {
  if (typeof action === 'function') {
    return action(store.dispatch.bind(store), store.getState.bind(store));
  }

  return next();
}

/**
 * Async Middleware
 */
function asyncMiddleware(store, action, next) {
  if (action.payload && typeof action.payload.then === 'function') {
    return action.payload.then(
      (result) => {
        store.dispatch(new Action(action.type + '_SUCCESS', result, action.meta));
      },
      (error) => {
        store.dispatch(new Action(action.type + '_ERROR', error, action.meta));
      }
    );
  }

  return next();
}

/**
 * State Manager
 */
class StateManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      enablePersistence: false,
      persistenceKey: 'app-state',
      enableDevTools: false,
      ...options
    };

    this.stores = new Map();
    this.globalReducers = new Map();
  }

  /**
   * Create store
   */
  createStore(name, reducer, initialState = {}, options = {}) {
    const store = new Store(reducer, initialState, {
      ...this.config,
      ...options
    });

    this.stores.set(name, store);

    // Forward events
    store.on('state-changed', (data) => {
      this.emit('store-changed', { store: name, ...data });
    });

    this.emit('store-created', name);

    return store;
  }

  /**
   * Get store
   */
  getStore(name) {
    return this.stores.get(name);
  }

  /**
   * Remove store
   */
  removeStore(name) {
    const store = this.stores.get(name);
    if (store) {
      store.removeAllListeners();
      this.stores.delete(name);
      this.emit('store-removed', name);
      return true;
    }
    return false;
  }

  /**
   * Register global reducer
   */
  registerReducer(name, reducer) {
    this.globalReducers.set(name, reducer);
    this.emit('reducer-registered', name);
    return this;
  }

  /**
   * Create reducer
   */
  createReducer(initialState, handlers) {
    return new Reducer(initialState, handlers);
  }

  /**
   * Create action
   */
  createAction(type, payload, meta) {
    return new Action(type, payload, meta);
  }

  /**
   * Combine reducers
   */
  combineReducers(reducers) {
    return combineReducers(reducers);
  }

  /**
   * Persist state
   */
  persistState(name, state) {
    if (!this.config.enablePersistence) return;

    try {
      const key = `${this.config.persistenceKey}:${name}`;
      const serialized = JSON.stringify(state);

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, serialized);
      }
    } catch (err) {
      this.emit('persistence-error', err);
    }
  }

  /**
   * Restore state
   */
  restoreState(name) {
    if (!this.config.enablePersistence) return null;

    try {
      const key = `${this.config.persistenceKey}:${name}`;

      if (typeof localStorage !== 'undefined') {
        const serialized = localStorage.getItem(key);
        return serialized ? JSON.parse(serialized) : null;
      }
    } catch (err) {
      this.emit('persistence-error', err);
    }

    return null;
  }

  /**
   * Get all stores
   */
  getAllStores() {
    return Array.from(this.stores.keys());
  }

  /**
   * Get statistics
   */
  getStats() {
    const stats = {
      stores: this.stores.size,
      reducers: this.globalReducers.size,
      storeStats: {}
    };

    for (const [name, store] of this.stores) {
      stats.storeStats[name] = store.getStats();
    }

    return stats;
  }

  /**
   * Destroy manager
   */
  destroy() {
    for (const store of this.stores.values()) {
      store.removeAllListeners();
    }

    this.stores.clear();
    this.globalReducers.clear();
    this.removeAllListeners();
  }
}

module.exports = {
  Action,
  Reducer,
  Middleware,
  Store,
  StateManager,
  combineReducers,
  loggerMiddleware,
  thunkMiddleware,
  asyncMiddleware
};
