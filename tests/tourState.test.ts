import { describe, it, expect, beforeEach } from 'vitest';
import { startTour, getTourState, setTourStep, endTour } from '@/lib/tourState';

const KEY = 'ss_guided_tour';

beforeEach(() => {
  sessionStorage.clear();
});

describe('startTour', () => {
  it('creates a tour state in sessionStorage', () => {
    startTour('screenwriter', 'proj-1');
    const state = getTourState();
    expect(state).not.toBeNull();
    expect(state!.active).toBe(true);
    expect(state!.step).toBe(0);
    expect(state!.intent).toBe('screenwriter');
    expect(state!.projectId).toBe('proj-1');
  });
});

describe('getTourState', () => {
  it('returns null when no tour is active', () => {
    expect(getTourState()).toBeNull();
  });

  it('returns parsed state when tour exists', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ active: true, step: 3, intent: 'filmmaker', projectId: 'p1' }));
    const state = getTourState();
    expect(state).toEqual({ active: true, step: 3, intent: 'filmmaker', projectId: 'p1' });
  });

  it('returns null for invalid JSON', () => {
    sessionStorage.setItem(KEY, 'not-json');
    expect(getTourState()).toBeNull();
  });
});

describe('setTourStep', () => {
  it('updates the step in existing tour', () => {
    startTour('screenwriter', null);
    setTourStep(5);
    expect(getTourState()!.step).toBe(5);
  });

  it('does nothing if no tour exists', () => {
    setTourStep(5);
    expect(getTourState()).toBeNull();
  });
});

describe('endTour', () => {
  it('removes tour from sessionStorage', () => {
    startTour('screenwriter', null);
    endTour();
    expect(getTourState()).toBeNull();
  });

  it('does nothing if no tour exists', () => {
    endTour();
    expect(getTourState()).toBeNull();
  });
});
