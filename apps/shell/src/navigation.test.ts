import { describe, expect, it } from 'vitest';
import {
  DRAG_THRESHOLD_PX,
  type SheetHeight,
  afterBack,
  afterGesture,
  afterPickingChannel,
  afterPickingServer,
  canGoBack,
  toggled,
} from './navigation.js';

describe('the small-screen stack', () => {
  it('shows what is inside a server once one is chosen', () => {
    expect(afterPickingServer()).toBe('channels');
  });

  it('opens a channel once one is chosen', () => {
    expect(afterPickingChannel()).toBe('channel');
  });

  it('returns to the list when going back', () => {
    expect(afterBack()).toBe('channels');
  });

  it('offers a way back from an open channel', () => {
    expect(canGoBack('channel')).toBe(true);
  });

  it('offers no way back from the list, which is the root', () => {
    expect(canGoBack('channels')).toBe(false);
  });
});

describe('the chat sheet', () => {
  it('opens when it is closed', () => {
    expect(toggled('peek')).toBe('open');
  });

  it('closes when it is open', () => {
    expect(toggled('open')).toBe('peek');
  });

  it('returns to where it started when toggled twice', () => {
    expect(toggled(toggled('peek'))).toBe('peek');
    expect(toggled(toggled('open'))).toBe('open');
  });

  describe('gestures on the handle', () => {
    // Screen coordinates grow downwards, so dragging up is negative.
    it('opens the sheet when dragged up past the threshold', () => {
      expect(afterGesture('peek', -DRAG_THRESHOLD_PX)).toBe('open');
    });

    it('closes the sheet when dragged down past the threshold', () => {
      expect(afterGesture('open', DRAG_THRESHOLD_PX)).toBe('peek');
    });

    // Exactly at the threshold is a drag, not a tap: a drag in the direction
    // the sheet already sits leaves it there, where a tap would toggle it.
    it('counts a gesture of exactly the threshold as a drag', () => {
      expect(afterGesture('open', -DRAG_THRESHOLD_PX)).toBe('open');
      expect(afterGesture('peek', DRAG_THRESHOLD_PX)).toBe('peek');
    });

    it('leaves an open sheet open when dragged further up', () => {
      expect(afterGesture('open', -200)).toBe('open');
    });

    it('leaves a closed sheet closed when dragged further down', () => {
      expect(afterGesture('peek', 200)).toBe('peek');
    });

    it('treats a gesture too small to be a drag as a tap, which toggles', () => {
      expect(afterGesture('peek', -(DRAG_THRESHOLD_PX - 1))).toBe('open');
      expect(afterGesture('open', DRAG_THRESHOLD_PX - 1)).toBe('peek');
    });

    it('treats a finger that did not move at all as a tap', () => {
      expect(afterGesture('open', 0)).toBe('peek');
      expect(afterGesture('peek', 0)).toBe('open');
    });

    it.each<SheetHeight>(['peek', 'open'])(
      'toggles %s when the gesture is under the threshold',
      (height) => {
        expect(afterGesture(height, 1)).toBe(toggled(height));
      },
    );
  });
});
