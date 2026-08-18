import { describe, expect, it } from 'vitest';
import {
  DRAG_THRESHOLD_PX,
  type SheetHeight,
  afterBack,
  afterDragging,
  afterPickingChannel,
  afterPickingServer,
  afterTappingHandle,
  canGoBack,
  collapsed,
  expanded,
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
  it('rises one step when expanded', () => {
    expect(expanded('peek')).toBe('half');
    expect(expanded('half')).toBe('full');
  });

  it('cannot rise past fully open', () => {
    expect(expanded('full')).toBe('full');
  });

  it('falls one step when collapsed', () => {
    expect(collapsed('full')).toBe('half');
    expect(collapsed('half')).toBe('peek');
  });

  it('cannot fall below a peek, so chat never disappears entirely', () => {
    expect(collapsed('peek')).toBe('peek');
  });

  describe('tapping the handle', () => {
    it('opens the sheet a step at a time', () => {
      expect(afterTappingHandle('peek')).toBe('half');
      expect(afterTappingHandle('half')).toBe('full');
    });

    it('closes it again once fully open, so one control does both', () => {
      expect(afterTappingHandle('full')).toBe('peek');
    });
  });

  describe('dragging', () => {
    // Screen coordinates grow downwards, so dragging up is negative.
    it('opens the sheet when dragged up past the threshold', () => {
      expect(afterDragging('peek', -DRAG_THRESHOLD_PX)).toBe('half');
    });

    it('closes the sheet when dragged down past the threshold', () => {
      expect(afterDragging('half', DRAG_THRESHOLD_PX)).toBe('peek');
    });

    it('ignores a drag too small to be deliberate', () => {
      expect(afterDragging('half', -(DRAG_THRESHOLD_PX - 1))).toBe('half');
      expect(afterDragging('half', DRAG_THRESHOLD_PX - 1)).toBe('half');
    });

    it('ignores a finger that did not move at all', () => {
      expect(afterDragging('half', 0)).toBe('half');
    });

    it('moves exactly one step however far the drag went', () => {
      expect(afterDragging('peek', -5000)).toBe('half');
    });

    it.each<SheetHeight>(['peek', 'half', 'full'])(
      'leaves %s alone when the drag is under the threshold',
      (height) => {
        expect(afterDragging(height, 1)).toBe(height);
      },
    );
  });
});
