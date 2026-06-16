import { describe, it, expect, beforeEach } from 'vitest';
import { useScriptStore, useAuthStore, useProjectStore, usePresenceStore, useNotificationStore } from '@/lib/stores';
import type { ScriptElement, Notification } from '@/lib/types';

function makeElement(overrides: Partial<ScriptElement> = {}): ScriptElement {
  return {
    id: 'el-' + Math.random().toString(36).slice(2, 8),
    element_type: 'action',
    content: 'test content',
    sort_order: 0,
    scene_number: null,
    revision_color: 'white',
    is_revised: false,
    is_omitted: false,
    scene_status: null,
    metadata: {},
    created_by: null,
    last_edited_by: null,
    script_id: 's1',
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-' + Math.random().toString(36).slice(2, 8),
    title: 'Test Notification',
    body: 'Test body',
    read: false,
    link: null,
    created_at: new Date().toISOString(),
    actor_id: null,
    user_id: 'user-1',
    type: 'mention',
    ...overrides,
  } as Notification;
}

// ─── Auth Store ───────────────────────────────────────────────────────────────

describe('Auth Store', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, loading: true, initialized: false });
  });

  it('has correct default state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(true);
    expect(state.initialized).toBe(false);
  });

  it('setUser updates user', () => {
    const user = { id: 'u1', display_name: 'Test', avatar_url: null } as any;
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('setUser can clear user', () => {
    useAuthStore.getState().setUser({ id: 'u1' } as any);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setLoading updates loading', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('setInitialized updates initialized', () => {
    useAuthStore.getState().setInitialized(true);
    expect(useAuthStore.getState().initialized).toBe(true);
  });
});

// ─── Project Store ────────────────────────────────────────────────────────────

describe('Project Store', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], currentProject: null, members: [], loading: false });
  });

  it('has correct default state', () => {
    const state = useProjectStore.getState();
    expect(state.projects).toEqual([]);
    expect(state.currentProject).toBeNull();
    expect(state.members).toEqual([]);
  });

  it('setProjects updates projects', () => {
    const projects = [{ id: 'p1', name: 'Project 1' }] as any[];
    useProjectStore.getState().setProjects(projects);
    expect(useProjectStore.getState().projects).toEqual(projects);
  });

  it('setCurrentProject updates currentProject', () => {
    const project = { id: 'p1', name: 'My Project' } as any;
    useProjectStore.getState().setCurrentProject(project);
    expect(useProjectStore.getState().currentProject).toEqual(project);
  });

  it('setCurrentProject can clear', () => {
    useProjectStore.getState().setCurrentProject({ id: 'p1' } as any);
    useProjectStore.getState().setCurrentProject(null);
    expect(useProjectStore.getState().currentProject).toBeNull();
  });

  it('setMembers updates members', () => {
    const members = [{ id: 'm1', user_id: 'u1' }] as any[];
    useProjectStore.getState().setMembers(members);
    expect(useProjectStore.getState().members).toEqual(members);
  });

  it('setLoading updates loading', () => {
    useProjectStore.getState().setLoading(true);
    expect(useProjectStore.getState().loading).toBe(true);
  });
});

// ─── Script Store ─────────────────────────────────────────────────────────────

describe('Script Store', () => {
  beforeEach(() => {
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
      const elements = [makeElement({ id: '1', content: 'INT. ROOM' })];
      useScriptStore.setState({ elements });

      useScriptStore.getState().pushHistory();

      const state = useScriptStore.getState();
      expect(state._undoStack).toHaveLength(1);
      expect(state._undoStack[0][0].content).toBe('INT. ROOM');
    });

    it('should clear redo stack on new push', () => {
      useScriptStore.setState({ _redoStack: [[makeElement({ id: 'old' })]] });
      useScriptStore.getState().pushHistory();
      expect(useScriptStore.getState()._redoStack).toHaveLength(0);
    });

    it('should cap undo stack at 50 entries', () => {
      const bigStack = Array.from({ length: 55 }, () => [makeElement()]);
      useScriptStore.setState({ _undoStack: bigStack });
      useScriptStore.getState().pushHistory();
      expect(useScriptStore.getState()._undoStack).toHaveLength(50);
    });

    it('should create deep copies of elements', () => {
      const elements = [makeElement({ id: '1', content: 'original' })];
      useScriptStore.setState({ elements });
      useScriptStore.getState().pushHistory();

      // Modify original - undo stack should not be affected
      useScriptStore.setState({ elements: [makeElement({ id: '1', content: 'modified' })] });
      expect(useScriptStore.getState()._undoStack[0][0].content).toBe('original');
    });
  });

  describe('undo', () => {
    it('does nothing when undo stack is empty', () => {
      const before = useScriptStore.getState().elements;
      useScriptStore.getState().undo();
      expect(useScriptStore.getState().elements).toEqual(before);
    });

    it('restores previous elements', () => {
      const prevElements = [makeElement({ id: '1', content: 'before' })];
      useScriptStore.setState({
        _undoStack: [prevElements],
        elements: [makeElement({ id: '1', content: 'after' })],
      });

      useScriptStore.getState().undo();

      expect(useScriptStore.getState().elements[0].content).toBe('before');
    });

    it('pushes current state to redo stack', () => {
      const current = [makeElement({ id: '1', content: 'current' })];
      const previous = [makeElement({ id: '1', content: 'previous' })];
      useScriptStore.setState({
        _undoStack: [previous],
        elements: current,
      });

      useScriptStore.getState().undo();

      expect(useScriptStore.getState()._redoStack).toHaveLength(1);
      expect(useScriptStore.getState()._redoStack[0][0].content).toBe('current');
    });

    it('removes from undo stack', () => {
      useScriptStore.setState({
        _undoStack: [[makeElement()]],
        elements: [makeElement()],
      });
      useScriptStore.getState().undo();
      expect(useScriptStore.getState()._undoStack).toHaveLength(0);
    });
  });

  describe('redo', () => {
    it('does nothing when redo stack is empty', () => {
      const before = useScriptStore.getState().elements;
      useScriptStore.getState().redo();
      expect(useScriptStore.getState().elements).toEqual(before);
    });

    it('restores next elements', () => {
      const next = [makeElement({ id: '1', content: 'next' })];
      useScriptStore.setState({
        _redoStack: [next],
        elements: [makeElement({ id: '1', content: 'current' })],
      });

      useScriptStore.getState().redo();

      expect(useScriptStore.getState().elements[0].content).toBe('next');
    });

    it('pushes current state to undo stack', () => {
      useScriptStore.setState({
        _redoStack: [[makeElement({ id: '1', content: 'redo' })]],
        elements: [makeElement({ id: '1', content: 'current' })],
      });

      useScriptStore.getState().redo();

      expect(useScriptStore.getState()._undoStack).toHaveLength(1);
      expect(useScriptStore.getState()._undoStack[0][0].content).toBe('current');
    });

    it('removes from redo stack', () => {
      useScriptStore.setState({
        _redoStack: [[makeElement()]],
        elements: [makeElement()],
      });
      useScriptStore.getState().redo();
      expect(useScriptStore.getState()._redoStack).toHaveLength(0);
    });
  });

  describe('undo/redo round-trip', () => {
    it('undo then redo restores original', () => {
      const original = [makeElement({ id: '1', content: 'original' })];
      const modified = [makeElement({ id: '1', content: 'modified' })];

      useScriptStore.setState({ elements: original });
      useScriptStore.getState().pushHistory();
      useScriptStore.setState({ elements: modified });

      useScriptStore.getState().undo();
      expect(useScriptStore.getState().elements[0].content).toBe('original');

      useScriptStore.getState().redo();
      expect(useScriptStore.getState().elements[0].content).toBe('modified');
    });

    it('new push after undo clears redo', () => {
      useScriptStore.setState({
        _undoStack: [[makeElement({ id: '1', content: 'prev' })]],
        _redoStack: [[makeElement({ id: '1', content: 'redo' })]],
        elements: [makeElement({ id: '1', content: 'current' })],
      });

      useScriptStore.getState().undo();
      useScriptStore.getState().pushHistory();

      expect(useScriptStore.getState()._redoStack).toHaveLength(0);
    });
  });

  describe('setElements', () => {
    it('should set elements', () => {
      const elements = [makeElement({ id: '1', content: 'TEST' })];
      useScriptStore.getState().setElements(elements);
      expect(useScriptStore.getState().elements).toEqual(elements);
    });

    it('should replace existing elements', () => {
      useScriptStore.setState({ elements: [makeElement({ id: 'old' })] });
      const newElements = [makeElement({ id: 'new' })];
      useScriptStore.getState().setElements(newElements);
      expect(useScriptStore.getState().elements).toHaveLength(1);
      expect(useScriptStore.getState().elements[0].id).toBe('new');
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

  describe('setScripts', () => {
    it('should set scripts', () => {
      const scripts = [{ id: 's1', title: 'Script 1' }] as any[];
      useScriptStore.getState().setScripts(scripts);
      expect(useScriptStore.getState().scripts).toEqual(scripts);
    });
  });

  describe('setCurrentScript', () => {
    it('should set current script', () => {
      const script = { id: 's1', title: 'My Script' } as any;
      useScriptStore.getState().setCurrentScript(script);
      expect(useScriptStore.getState().currentScript).toEqual(script);
    });
  });

  describe('setSaving', () => {
    it('should set saving state', () => {
      useScriptStore.getState().setSaving(true);
      expect(useScriptStore.getState().saving).toBe(true);
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      useScriptStore.getState().setLoading(true);
      expect(useScriptStore.getState().loading).toBe(true);
    });
  });
});

// ─── Presence Store ───────────────────────────────────────────────────────────

describe('Presence Store', () => {
  beforeEach(() => {
    usePresenceStore.setState({ onlineUsers: [] });
  });

  it('has correct default state', () => {
    expect(usePresenceStore.getState().onlineUsers).toEqual([]);
  });

  it('setOnlineUsers updates users', () => {
    const users = [{ user_id: 'u1', online: true }] as any[];
    usePresenceStore.getState().setOnlineUsers(users);
    expect(usePresenceStore.getState().onlineUsers).toEqual(users);
  });

  it('can clear users', () => {
    usePresenceStore.setState({ onlineUsers: [{ user_id: 'u1' }] as any[] });
    usePresenceStore.getState().setOnlineUsers([]);
    expect(usePresenceStore.getState().onlineUsers).toEqual([]);
  });
});

// ─── Notification Store ───────────────────────────────────────────────────────

describe('Notification Store', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0, loading: false });
  });

  it('has correct default state', () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.unreadCount).toBe(0);
  });

  describe('setNotifications', () => {
    it('sets notifications', () => {
      const notifs = [makeNotification()];
      useNotificationStore.getState().setNotifications(notifs);
      expect(useNotificationStore.getState().notifications).toEqual(notifs);
    });
  });

  describe('setUnreadCount', () => {
    it('sets unread count', () => {
      useNotificationStore.getState().setUnreadCount(5);
      expect(useNotificationStore.getState().unreadCount).toBe(5);
    });
  });

  describe('addNotification', () => {
    it('adds notification to front of list', () => {
      const existing = makeNotification({ id: 'existing' });
      useNotificationStore.setState({ notifications: [existing], unreadCount: 0 });

      const newNotif = makeNotification({ id: 'new', read: false });
      useNotificationStore.getState().addNotification(newNotif);

      const state = useNotificationStore.getState();
      expect(state.notifications[0].id).toBe('new');
      expect(state.unreadCount).toBe(1);
    });

    it('increments unread count for unread notifications', () => {
      useNotificationStore.setState({ unreadCount: 0 });
      useNotificationStore.getState().addNotification(makeNotification({ read: false }));
      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('does not increment unread count for read notifications', () => {
      useNotificationStore.setState({ unreadCount: 0 });
      useNotificationStore.getState().addNotification(makeNotification({ read: true }));
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('does not add duplicate notifications', () => {
      const notif = makeNotification({ id: 'dup' });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 0 });
      useNotificationStore.getState().addNotification(notif);
      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read and decrements unread', () => {
      const notif = makeNotification({ id: 'n1', read: false });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 1 });

      useNotificationStore.getState().markAsRead('n1');

      const state = useNotificationStore.getState();
      expect(state.notifications[0].read).toBe(true);
      expect(state.unreadCount).toBe(0);
    });

    it('does not decrement unread for already-read notification', () => {
      const notif = makeNotification({ id: 'n1', read: true });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 0 });

      useNotificationStore.getState().markAsRead('n1');
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read', () => {
      const notifs = [
        makeNotification({ id: 'n1', read: false }),
        makeNotification({ id: 'n2', read: false }),
      ];
      useNotificationStore.setState({ notifications: notifs, unreadCount: 2 });

      useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications.every(n => n.read)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('removes notification and adjusts unread count', () => {
      const notifs = [
        makeNotification({ id: 'n1', read: false }),
        makeNotification({ id: 'n2', read: true }),
      ];
      useNotificationStore.setState({ notifications: notifs, unreadCount: 1 });

      useNotificationStore.getState().deleteNotification('n1');

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].id).toBe('n2');
      expect(state.unreadCount).toBe(0);
    });

    it('does not underflow unread count below 0', () => {
      const notifs = [makeNotification({ id: 'n1', read: true })];
      useNotificationStore.setState({ notifications: notifs, unreadCount: 0 });

      useNotificationStore.getState().deleteNotification('n1');
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('handles deleting non-existent notification', () => {
      useNotificationStore.setState({
        notifications: [makeNotification({ id: 'n1', read: false })],
        unreadCount: 1,
      });
      useNotificationStore.getState().deleteNotification('nonexistent');
      expect(useNotificationStore.getState().notifications).toHaveLength(1);
      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });
  });
});
