import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import '@angular/compiler';
import { of, Subject } from 'rxjs';

register('./typescript-loader.mjs', import.meta.url);
const { HubStore } = await import('../src/app/core/store/hub.store.ts');
const { EditorStore } = await import('../src/app/features/editor/components/editor.store.ts');
const { EditorComponent } = await import('../src/app/features/editor/components/editor.component.ts');
const { LayerType } = await import('../src/app/shared/types/layer.types.ts');
const { ImageEditorComponent } = await import('../src/app/features/editor/components/layer-editors/image-editor.component.ts');
const { VideoEditorComponent } = await import('../src/app/features/editor/components/layer-editors/video-editor.component.ts');

function layer(id = 'layer', changes = {}) {
  return {
    id, name: id, type: LayerType.Shape, visible: true, groupId: null,
    position: { x: 200, y: 200 }, width: 100, height: 100, ...changes,
  };
}

function hub(id = 'hub', layers = [layer()]) {
  return { _id: id, hubName: id, layout: { backgroundId: 'transparent', layers } };
}

function setup(hubs = [hub()], apiChanges = {}) {
  const api = {
    getMyHubs: () => of(structuredClone(hubs)),
    updateHub: (id, request) => of({ _id: id, ...structuredClone(request) }),
    deleteHub: () => of(undefined),
    ...apiChanges,
  };
  const store = new HubStore(api);
  store.loadMyHubs();
  return { store, api };
}

test('layer creation and deletion undo and redo with synchronized layout and saved state', () => {
  const { store } = setup();
  const initial = structuredClone(store.selectedHub());
  assert.equal(store.canUndo(), false);
  assert.equal(store.undoSelectedHub(), false);
  store.addLayer(layer('new'));
  assert.equal(store.canUndo(), true);
  assert.equal(store.hasUnsavedChanges(), true);
  assert.equal(store.undoSelectedHub(), true);
  assert.deepEqual(store.selectedHub(), initial);
  assert.equal(store.hasUnsavedChanges(), false);
  assert.equal(store.canRedo(), true);
  store.redoSelectedHub();
  assert.equal(store.selectedHub().layers[0].id, 'new');
  store.removeLayer('new');
  store.undoSelectedHub();
  assert.equal(store.selectedHub().layers[0].id, 'new');
  assert.equal(store.selectedHub().layout.layers, store.selectedHub().layers);
});

test('position, size, styles, visibility, names, order, and background are reversible', () => {
  const { store } = setup([hub('hub', [layer('a'), layer('b')])]);
  const initial = structuredClone(store.selectedHub());
  store.updateLayer('a', { position: { x: 450, y: 300 } });
  store.updateLayer('a', { width: 250, height: 160 });
  store.updateLayer('a', { style: { color: '#ff0000', customCss: 'opacity: .5;' } });
  store.updateLayer('a', { visible: false, name: 'Renamed' });
  store.reorderLayer('a', 1);
  store.updateSelectedHubBackground('classic-gradient');
  const edited = structuredClone(store.selectedHub());
  for (let i = 0; i < 6; i++) assert.equal(store.undoSelectedHub(), true);
  assert.deepEqual(store.selectedHub(), initial);
  for (let i = 0; i < 6; i++) assert.equal(store.redoSelectedHub(), true);
  assert.deepEqual(store.selectedHub(), edited);
});

test('undoing group deletion restores the group and its children', () => {
  const group = layer('group', { type: LayerType.Group, collapsed: false });
  const { store } = setup([hub('hub', [group, layer('child', { groupId: 'group' })])]);
  const initial = structuredClone(store.selectedHub());
  store.removeLayer('group');
  assert.equal(store.selectedHub().layers[0].groupId, null);
  store.undoSelectedHub();
  assert.deepEqual(store.selectedHub(), initial);
  const editor = new EditorStore(store);
  editor.setLayerGroup('child', null);
  store.undoSelectedHub();
  assert.equal(store.selectedHub().layers[1].groupId, 'group');
});

test('continuous movement and resizing each consume one undo step', () => {
  const { store } = setup();
  const initial = structuredClone(store.selectedHub());
  store.beginHistoryGroup();
  for (let x = 210; x <= 300; x += 10) store.updateLayer('layer', { position: { x, y: 200 } });
  store.endHistoryGroup();
  const moved = structuredClone(store.selectedHub());
  store.beginHistoryGroup();
  for (let width = 110; width <= 200; width += 10) store.updateLayer('layer', { width });
  store.endHistoryGroup();
  store.undoSelectedHub();
  assert.deepEqual(store.selectedHub(), moved);
  store.undoSelectedHub();
  assert.deepEqual(store.selectedHub(), initial);
  assert.equal(store.canUndo(), false);
});

test('no-op edits preserve undo and redo history', () => {
  const { store } = setup();
  assert.equal(store.updateLayer('missing', { name: 'Missing' }), false);
  assert.equal(store.removeLayer('missing'), false);
  assert.equal(store.reorderLayer('layer', -1), false);
  assert.equal(store.updateLayer('layer', { position: { x: 200, y: 200 } }), false);
  assert.equal(store.updateSelectedHubBackground('transparent'), false);
  store.beginHistoryGroup();
  store.endHistoryGroup();
  assert.equal(store.canUndo(), false);
  assert.equal(store.hasUnsavedChanges(), false);
  store.updateLayer('layer', { name: 'Edited' });
  store.undoSelectedHub();
  store.updateLayer('layer', { name: 'layer' });
  assert.equal(store.canRedo(), true);
});

test('a new edit after undo clears redo history', () => {
  const { store } = setup();
  store.updateLayer('layer', { name: 'First' });
  store.undoSelectedHub();
  store.updateLayer('layer', { name: 'Second' });
  assert.equal(store.canRedo(), false);
  assert.equal(store.redoSelectedHub(), false);
});

test('history belongs to its hub when switching hubs', () => {
  const { store } = setup([hub('a'), hub('b')]);
  store.updateLayer('layer', { name: 'Edited A' });
  store.selectHub('b');
  assert.equal(store.canUndo(), false);
  store.updateLayer('layer', { name: 'Edited B' });
  store.undoSelectedHub();
  assert.equal(store.selectedHub().layers[0].name, 'layer');
  store.selectHub('a');
  assert.equal(store.selectedHub().layers[0].name, 'Edited A');
  store.undoSelectedHub();
  assert.equal(store.selectedHub().layers[0].name, 'layer');
});

test('history is bounded to the last 100 edits', () => {
  const { store } = setup();
  for (let i = 1; i <= 105; i++) store.updateLayer('layer', { name: `Edit ${i}` });
  for (let i = 0; i < 100; i++) assert.equal(store.undoSelectedHub(), true);
  assert.equal(store.selectedHub().layers[0].name, 'Edit 5');
  assert.equal(store.canUndo(), false);
});

test('saving preserves history and returning to the saved version is clean', () => {
  const { store } = setup();
  store.updateLayer('layer', { name: 'Saved edit' });
  store.saveSelectedHub();
  assert.equal(store.hasUnsavedChanges(), false);
  assert.equal(store.canUndo(), true);
  store.undoSelectedHub();
  assert.equal(store.hasUnsavedChanges(), true);
  store.redoSelectedHub();
  assert.equal(store.hasUnsavedChanges(), false);
});

test('a pending save cannot overwrite undo and updates the saved baseline', () => {
  const pending = new Subject();
  let savedResponse;
  const { store } = setup([hub()], {
    updateHub: (id, request) => {
      savedResponse = { _id: id, ...structuredClone(request) };
      return pending;
    },
  });
  store.updateLayer('layer', { name: 'Saved edit' });
  store.saveSelectedHub();
  store.undoSelectedHub();
  pending.next(savedResponse);
  pending.complete();
  assert.equal(store.selectedHub().layers[0].name, 'layer');
  assert.equal(store.hasUnsavedChanges(), true);
  store.redoSelectedHub();
  assert.equal(store.hasUnsavedChanges(), false);
});

test('redoing a newly created and saved layer remains clean after default normalization', () => {
  const { store } = setup();
  const editor = new EditorStore(store);
  store.addLayer(editor.createLayer(LayerType.Text));
  store.saveSelectedHub();
  store.undoSelectedHub();
  store.redoSelectedHub();
  assert.equal(store.hasUnsavedChanges(), false);
});

test('loading or deleting hubs clears their history', () => {
  const { store } = setup([hub('a'), hub('b')]);
  store.updateLayer('layer', { name: 'Edited' });
  store.loadMyHubs();
  assert.equal(store.canUndo(), false);
  store.updateLayer('layer', { name: 'Edited again' });
  store.deleteHub('a').subscribe();
  assert.equal(store.selectedHubId(), 'b');
  assert.equal(store.canUndo(), false);
});

test('image and video history never restores temporary upload URLs', () => {
  for (const type of [LayerType.Image, LayerType.Video]) {
    const { store } = setup([hub('hub', [layer('media', { type, src: '/old-media', mediaUploadStatus: 'ready' })])]);
    store.updateLayer('media', { src: 'blob:upload-preview', mediaUploadStatus: 'uploading' });
    store.updateLayer('media', { width: 250 });
    store.updateLayer('media', { src: '/uploaded-media', mediaUploadStatus: 'ready' });
    store.undoSelectedHub();
    assert.equal(store.selectedHub().layers[0].src, '/old-media');
    assert.equal(store.selectedHub().layers[0].mediaUploadStatus, 'ready');
    store.redoSelectedHub();
    assert.equal(store.selectedHub().layers[0].src, '/uploaded-media');
  }
});

class Element {
  constructor(tagName = 'DIV', editable = false, type = 'text') {
    this.tagName = tagName;
    this.isContentEditable = editable;
    this.type = type;
  }
}

globalThis.HTMLElement = Element;
globalThis.document = new EventTarget();
globalThis.document.createElement = () => ({});
globalThis.Image = class {};

test('late image and video upload responses respect undo', async () => {
  for (const [type, Editor, method, apiMethod] of [
    [LayerType.Image, ImageEditorComponent, 'uploadImage', 'uploadImage'],
    [LayerType.Video, VideoEditorComponent, 'uploadVideo', 'uploadVideo'],
  ]) {
    const { store } = setup([hub('hub', [layer('media', { type, src: '/old-media', alt: '', mediaUploadStatus: 'ready' })])]);
    const pending = new Subject();
    const editor = new Editor(new EditorStore(store), { [apiMethod]: () => pending });
    editor.layer = store.selectedHub().layers[0];
    const file = new Blob(['media']);
    file.name = 'upload';
    const upload = editor[method]({ target: { files: [file] } });
    assert.equal(store.selectedHub().layers[0].mediaUploadStatus, 'uploading');
    store.undoSelectedHub();
    pending.next({ url: '/uploaded-media', originalName: 'upload', key: 'upload', storage: 'local' });
    pending.complete();
    await upload;
    assert.equal(store.selectedHub().layers[0].src, '/old-media');
    assert.equal(store.canUndo(), false);
    store.redoSelectedHub();
    assert.equal(store.selectedHub().layers[0].src, '/old-media');
    assert.equal(store.selectedHub().layers[0].mediaUploadStatus, 'ready');
  }
});

function component(store) {
  return new EditorComponent({}, {}, new EditorStore(store), store);
}

function keyEvent(changes = {}) {
  return {
    key: 'z', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false,
    defaultPrevented: false, isComposing: false, target: new Element(),
    preventDefault() { this.defaultPrevented = true; }, ...changes,
  };
}

test('Ctrl/Cmd+Z undo and Ctrl/Cmd+Shift+Z or Ctrl+Y redo', () => {
  for (const redoKeys of [{ shiftKey: true }, { key: 'y' }, { metaKey: true, ctrlKey: false, shiftKey: true }]) {
    const { store } = setup();
    const editor = component(store);
    store.updateLayer('layer', { name: 'Edited' });
    const undo = keyEvent({ ctrlKey: false, metaKey: true, key: 'Z' });
    editor.handleHistoryShortcut(undo);
    assert.equal(store.selectedHub().layers[0].name, 'layer');
    assert.equal(undo.defaultPrevented, true);
    editor.handleHistoryShortcut(keyEvent(redoKeys));
    assert.equal(store.selectedHub().layers[0].name, 'Edited');
  }
});

test('shortcuts leave editable fields, IME composition, and handled events alone', () => {
  const { store } = setup();
  const editor = component(store);
  store.updateLayer('layer', { name: 'Edited' });
  for (const changes of [
    ...['INPUT', 'TEXTAREA'].map((tag) => ({ target: new Element(tag) })),
    { target: new Element('DIV', true) }, { altKey: true }, { isComposing: true },
    { defaultPrevented: true }, { ctrlKey: false }, { key: 'a' },
  ]) {
    editor.handleHistoryShortcut(keyEvent(changes));
    assert.equal(store.selectedHub().layers[0].name, 'Edited');
  }
});

test('shortcuts undo editor changes while dropdowns and non-text controls have focus', () => {
  for (const target of [
    new Element('SELECT'),
    ...['checkbox', 'radio', 'range', 'color', 'file'].map((type) => new Element('INPUT', false, type)),
  ]) {
    const { store } = setup();
    const editor = component(store);
    store.updateSelectedHubBackground('classic-gradient');
    const event = keyEvent({ target });
    editor.handleHistoryShortcut(event);
    assert.equal(store.selectedHub().layout.backgroundId, 'transparent');
    assert.equal(event.defaultPrevented, true);
  }
});

test('undoing a selected layer creation clears stale selection and menus', () => {
  const { store } = setup();
  const editor = component(store);
  store.addLayer(layer('new'));
  editor.editorStore.selectLayer('new');
  editor.editingLayerId.set('new');
  editor.undo();
  assert.equal(editor.editorStore.selectedLayerId(), null);
  assert.equal(editor.editingLayerId(), null);
});

test('undo during a drag stops movement and leaves the next edit independent', () => {
  const { store } = setup();
  const editor = component(store);
  const canvas = { getBoundingClientRect: () => ({ width: 1920, height: 1080 }) };
  const pointer = { clientX: 200, clientY: 200, preventDefault() {}, stopPropagation() {} };
  editor.startDrag(pointer, store.selectedHub().layers[0], canvas);
  editor.onDragMove({ clientX: 240, clientY: 230 });
  editor.onDragMove({ clientX: 260, clientY: 250 });
  editor.undo();
  assert.deepEqual(store.selectedHub().layers[0].position, { x: 200, y: 200 });
  editor.onDragMove({ clientX: 400, clientY: 400 });
  assert.deepEqual(store.selectedHub().layers[0].position, { x: 200, y: 200 });
  store.updateLayer('layer', { name: 'Next edit' });
  editor.undo();
  assert.equal(store.selectedHub().layers[0].name, 'layer');
  editor.ngOnDestroy();
});
