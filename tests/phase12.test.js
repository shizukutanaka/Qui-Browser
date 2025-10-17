const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  Action,
  Reducer,
  Store,
  StateManager,
  combineReducers,
  thunkMiddleware
} = require('../utils/state-manager');
const {
  Participant,
  Operation,
  CollaborativeDocument,
  PresenceManager,
  CollaborationManager
} = require('../utils/collaboration');
const {
  ManifestGenerator,
  InstallPromptManager,
  UpdateManager,
  OfflineManager,
  PWAManager
} = require('../utils/pwa-manager');

describe('State Management', () => {
  it('should create action', () => {
    const action = new Action('TEST_ACTION', { value: 123 });

    assert.ok(action);
    assert.strictEqual(action.type, 'TEST_ACTION');
    assert.strictEqual(action.payload.value, 123);
  });

  it('should create reducer', () => {
    const reducer = new Reducer({ count: 0 }, {
      INCREMENT: (state) => ({ count: state.count + 1 }),
      DECREMENT: (state) => ({ count: state.count - 1 })
    });

    assert.ok(reducer);
    assert.strictEqual(reducer.initialState.count, 0);
  });

  it('should reduce state', () => {
    const reducer = new Reducer({ count: 0 }, {
      INCREMENT: (state) => ({ count: state.count + 1 })
    });

    const action = new Action('INCREMENT');
    const newState = reducer.reduce({ count: 5 }, action);

    assert.strictEqual(newState.count, 6);
  });

  it('should create store', () => {
    const reducer = new Reducer({ count: 0 });
    const store = new Store(reducer);

    assert.ok(store);
    assert.strictEqual(store.getState().count, 0);
  });

  it('should dispatch action', () => {
    const reducer = new Reducer({ count: 0 }, {
      INCREMENT: (state) => ({ count: state.count + 1 })
    });

    const store = new Store(reducer, { count: 0 });

    store.dispatch(new Action('INCREMENT'));

    assert.strictEqual(store.getState().count, 1);
  });

  it('should subscribe to changes', (t, done) => {
    const reducer = new Reducer({ count: 0 }, {
      INCREMENT: (state) => ({ count: state.count + 1 })
    });

    const store = new Store(reducer, { count: 0 });

    store.subscribe((state) => {
      assert.strictEqual(state.count, 1);
      done();
    });

    store.dispatch(new Action('INCREMENT'));
  });

  it('should use middleware', () => {
    const reducer = new Reducer({ count: 0 });
    const store = new Store(reducer, { count: 0 });

    let middlewareCalled = false;

    store.use((store, action, next) => {
      middlewareCalled = true;
      return next();
    });

    store.dispatch(new Action('TEST'));

    assert.strictEqual(middlewareCalled, true);
  });

  it('should track action history', () => {
    const reducer = new Reducer({ count: 0 }, {
      INCREMENT: (state) => ({ count: state.count + 1 })
    });

    const store = new Store(reducer, { count: 0 }, { maxHistory: 10 });

    store.dispatch(new Action('INCREMENT'));
    store.dispatch(new Action('INCREMENT'));

    const history = store.getHistory();

    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].action.type, 'INCREMENT');
  });

  it('should combine reducers', () => {
    const counterReducer = new Reducer({ value: 0 });
    const userReducer = new Reducer({ name: '' });

    const combined = combineReducers({
      counter: counterReducer,
      user: userReducer
    });

    assert.ok(combined);
    assert.ok(combined.initialState.counter);
    assert.ok(combined.initialState.user);
  });

  it('should create state manager', () => {
    const manager = new StateManager();

    assert.ok(manager);

    manager.destroy();
  });

  it('should create and manage stores', () => {
    const manager = new StateManager();
    const reducer = new Reducer({ count: 0 });

    const store = manager.createStore('main', reducer);

    assert.ok(store);
    assert.strictEqual(manager.getStore('main'), store);

    manager.destroy();
  });
});

describe('Real-time Collaboration', () => {
  it('should create participant', () => {
    const participant = new Participant('user-1', { name: 'Alice' });

    assert.ok(participant);
    assert.strictEqual(participant.id, 'user-1');
    assert.strictEqual(participant.name, 'Alice');
    assert.ok(participant.color);
  });

  it('should update participant cursor', () => {
    const participant = new Participant('user-1');

    participant.updateCursor(100, 200);

    assert.ok(participant.cursor);
    assert.strictEqual(participant.cursor.x, 100);
    assert.strictEqual(participant.cursor.y, 200);
  });

  it('should update participant selection', () => {
    const participant = new Participant('user-1');

    participant.updateSelection(0, 10);

    assert.ok(participant.selection);
    assert.strictEqual(participant.selection.start, 0);
    assert.strictEqual(participant.selection.end, 10);
  });

  it('should create operation', () => {
    const op = new Operation('insert', {
      position: 0,
      content: 'Hello',
      userId: 'user-1'
    });

    assert.ok(op);
    assert.strictEqual(op.type, 'insert');
    assert.strictEqual(op.content, 'Hello');
  });

  it('should apply insert operation', () => {
    const op = new Operation('insert', {
      position: 0,
      content: 'Hello'
    });

    const result = op.apply('World');

    assert.strictEqual(result, 'HelloWorld');
  });

  it('should apply delete operation', () => {
    const op = new Operation('delete', {
      position: 0,
      length: 5
    });

    const result = op.apply('Hello World');

    assert.strictEqual(result, ' World');
  });

  it('should transform concurrent inserts', () => {
    const op1 = new Operation('insert', {
      position: 0,
      content: 'A',
      userId: 'user-1'
    });

    const op2 = new Operation('insert', {
      position: 0,
      content: 'B',
      userId: 'user-2'
    });

    const transformed = op2.transform(op1, 'right');

    assert.strictEqual(transformed.position, 1);
  });

  it('should create collaborative document', () => {
    const doc = new CollaborativeDocument('doc-1', 'Initial content');

    assert.ok(doc);
    assert.strictEqual(doc.id, 'doc-1');
    assert.strictEqual(doc.content, 'Initial content');
  });

  it('should apply operation to document', () => {
    const doc = new CollaborativeDocument('doc-1', '');

    const op = new Operation('insert', {
      position: 0,
      content: 'Hello'
    });

    doc.applyOperation(op);

    assert.strictEqual(doc.getContent(), 'Hello');
    assert.strictEqual(doc.getVersion(), 1);
  });

  it('should manage participants in document', () => {
    const doc = new CollaborativeDocument('doc-1');
    const participant = new Participant('user-1', { name: 'Alice' });

    doc.addParticipant(participant);

    assert.strictEqual(doc.participants.size, 1);
    assert.strictEqual(doc.getOnlineParticipants().length, 1);
  });

  it('should create presence manager', () => {
    const presence = new PresenceManager();

    assert.ok(presence);

    presence.destroy();
  });

  it('should manage presence', () => {
    const presence = new PresenceManager();
    const participant = new Participant('user-1');

    presence.addParticipant(participant);

    assert.strictEqual(presence.getParticipantCount(), 1);
    assert.strictEqual(presence.getOnlineCount(), 1);

    presence.destroy();
  });

  it('should create collaboration manager', () => {
    const manager = new CollaborationManager();

    assert.ok(manager);

    manager.destroy();
  });

  it('should create and manage documents', () => {
    const manager = new CollaborationManager();

    const doc = manager.createDocument('doc-1', 'Initial');

    assert.ok(doc);
    assert.strictEqual(manager.getDocument('doc-1'), doc);

    manager.destroy();
  });

  it('should join document', () => {
    const manager = new CollaborationManager();
    const doc = manager.createDocument('doc-1');
    const participant = new Participant('user-1');

    manager.joinDocument('doc-1', participant);

    assert.strictEqual(doc.participants.size, 1);

    manager.destroy();
  });
});

describe('Progressive Web App', () => {
  it('should create manifest generator', () => {
    const generator = new ManifestGenerator({
      name: 'Test App',
      short_name: 'Test'
    });

    assert.ok(generator);
    assert.strictEqual(generator.config.name, 'Test App');
  });

  it('should generate manifest', () => {
    const generator = new ManifestGenerator({
      name: 'Test App'
    });

    const manifest = generator.generate();

    assert.ok(manifest);
    assert.strictEqual(manifest.name, 'Test App');
    assert.ok(manifest.icons);
    assert.ok(manifest.icons.length > 0);
  });

  it('should generate icons array', () => {
    const generator = new ManifestGenerator();

    const icons = generator.generateIcons();

    assert.ok(icons.length > 0);
    assert.ok(icons[0].src);
    assert.ok(icons[0].sizes);
  });

  it('should create install prompt manager', () => {
    const installPrompt = new InstallPromptManager();

    assert.ok(installPrompt);
    assert.strictEqual(installPrompt.installed, false);
  });

  it('should check prompt availability', () => {
    const installPrompt = new InstallPromptManager();

    assert.strictEqual(installPrompt.isPromptAvailable(), false);
  });

  it('should create update manager', () => {
    const updateManager = new UpdateManager();

    assert.ok(updateManager);
    assert.strictEqual(updateManager.updateAvailable, false);

    updateManager.destroy();
  });

  it('should start and stop auto check', () => {
    const updateManager = new UpdateManager({ checkInterval: 1000 });

    updateManager.startAutoCheck();

    assert.ok(updateManager.checkTimer);

    updateManager.stopAutoCheck();

    assert.strictEqual(updateManager.checkTimer, null);

    updateManager.destroy();
  });

  it('should create offline manager', () => {
    const offlineManager = new OfflineManager();

    assert.ok(offlineManager);
    // In Node.js environment, online status is true by default
    assert.strictEqual(offlineManager.online, true);
  });

  it('should check online status', () => {
    const offlineManager = new OfflineManager();

    const online = offlineManager.isOnline();
    const offline = offlineManager.isOffline();

    // In Node.js, default is online
    assert.strictEqual(online, true);
    assert.strictEqual(offline, false);
  });

  it('should create PWA manager', () => {
    const pwa = new PWAManager();

    assert.ok(pwa);
    assert.ok(pwa.manifestGenerator);
    assert.ok(pwa.installPrompt);

    pwa.destroy();
  });

  it('should generate manifest from PWA manager', () => {
    const pwa = new PWAManager({
      manifest: {
        name: 'My App'
      }
    });

    const manifest = pwa.getManifest();

    assert.ok(manifest);
    assert.strictEqual(manifest.name, 'My App');

    pwa.destroy();
  });

  it('should get PWA statistics', () => {
    const pwa = new PWAManager();

    const stats = pwa.getStats();

    assert.ok(stats);
    assert.strictEqual(typeof stats.installed, 'boolean');
    // In Node.js, online is always true
    assert.strictEqual(stats.online, true);

    pwa.destroy();
  });
});

console.log('All Phase 12 tests completed!');
