import { describe, it, expect, beforeEach } from 'vitest';
import { useScriptStore } from '@/lib/stores';

describe('Script Store', () => {
  beforeEach(() => {
    const store = useScriptStore.getState();
    useScriptStore.setState({
      scripts: [],
      currentScript: null,
      elements: [],
      selectedElementId: null,
      loading: false,
      saving: false,
      _undoStack: [],
      _redoStack: [],
      _lastHistoryPush: 0,
    });
  });

  describe('pushHistory', () => {
    it('should snapshot current elements to undo stack', () => {
      const elements = [
        { id: '1', element_type: 'scene_heading', content: 'INT. ROOM', sort_order: 0, scene_number: '1', revision_color: 'white' as const, is_revised: false, is_omitted: false, scene_status: null, metadata: {}, created_by: null, last_edited_by: null, script_id: 's1', created_at: '', updated_at: '' },
      ];
      useScriptStore.setState({ elements });

      useScriptStore.getState().pushHistory();

      const state = useScriptStore.getState();
      expect(state._undoStack).toHaveLength(1);
      expect(state._undoStack[0]).toHaveLength(1);
      expect(state._undoStack[0][0].content).toBe('INT. ROOM');
    });

    it('should clear redo stack on new push', () => {
      useScriptStore.setState({ _redoStack: [[{ id: 'old', element_type: 'action', content: 'test', sort_order: 0, scene_number: null, revision_color: 'white' as const, is_revised: false, is_omitted: false, scene_status: null, metadata: {}, created_by: null, last_edited_by: null, script_id: 's1', created_at: '', updated_at: '' }]] });

      useScriptStore.getState().pushHistory();

      expect(useScriptStore.getState()._redoStack).toHaveLength(0);
    });

    it('should cap undo stack at 50 entries', () => {
      const bigStack = Array.from({ length: 55 }, (_, i) => [{ id: `${i}`, element_type: 'action' as const, content: `item ${i}`, sort_order: 0, scene_number: null, revision_color: 'white' as const, is_revised: false, is_omitted: false, scene_status: null, metadata: {}, created_by: null, last_edited_by: null, script_id: 's1', created_at: '', updated_at: '' }]);
      useScriptStore.setState({ _undoStack: bigStack });

      useScriptStore.getState().pushHistory();

      expect(useScriptStore.getState()._undoStack).toHaveLength(50);
    });
  });

  describe('setElements', () => {
    it('should set elements', () => {
      const elements = [
        { id: '1', element_type: 'scene_heading', content: 'TEST', sort_order: 0, scene_number: '1', revision_color: 'white' as const, is_revised: false, is_omitted: false, scene_status: null, metadata: {}, created_by: null, last_edited_by: null, script_id: 's1', created_at: '', updated_at: '' },
      ];
      useScriptStore.getState().setElements(elements);
      expect(useScriptStore.getState().elements).toEqual(elements);
    });
  });

  describe('setSelectedElementId', () => {
    it('should set selected element id', () => {
      useScriptStore.getState().setSelectedElementId('test-id');
      expect(useScriptStore.getState().selectedElementId).toBe('test-id');
    });

    it('should clear selected element id', () => {
      useScriptStore.getState().setSelectedElementId('test-id');
      useScriptStore.getState().setSelectedElementId(null);
      expect(useScriptStore.getState().selectedElementId).toBeNull();
    });
  });
});
