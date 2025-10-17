const EventEmitter = require('events');

/**
 * Virtual Scroller
 * Efficiently renders large lists by only rendering visible items
 */
class VirtualScroller extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      itemHeight: 50,
      containerHeight: 600,
      overscan: 3, // Number of items to render outside visible area
      estimatedItemHeight: 50,
      ...options
    };

    this.items = [];
    this.scrollTop = 0;
    this.visibleRange = { start: 0, end: 0 };
    this.renderedItems = [];
  }

  /**
   * Set items
   */
  setItems(items) {
    this.items = items;
    this.updateVisibleRange();
    this.emit('items-changed', { total: items.length });
    return this;
  }

  /**
   * Set scroll position
   */
  setScrollTop(scrollTop) {
    this.scrollTop = Math.max(0, scrollTop);
    this.updateVisibleRange();
    this.emit('scroll', { scrollTop: this.scrollTop });
    return this;
  }

  /**
   * Update visible range
   */
  updateVisibleRange() {
    const itemHeight = this.config.itemHeight;
    const containerHeight = this.config.containerHeight;
    const overscan = this.config.overscan;

    const start = Math.max(0, Math.floor(this.scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(this.items.length, start + visibleCount + overscan * 2);

    this.visibleRange = { start, end };
    this.renderedItems = this.items.slice(start, end);

    this.emit('range-changed', this.visibleRange);

    return this.visibleRange;
  }

  /**
   * Get visible items
   */
  getVisibleItems() {
    return this.renderedItems.map((item, index) => ({
      item,
      index: this.visibleRange.start + index,
      offset: (this.visibleRange.start + index) * this.config.itemHeight
    }));
  }

  /**
   * Get total height
   */
  getTotalHeight() {
    return this.items.length * this.config.itemHeight;
  }

  /**
   * Scroll to index
   */
  scrollToIndex(index) {
    const scrollTop = index * this.config.itemHeight;
    this.setScrollTop(scrollTop);
    return this;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalItems: this.items.length,
      visibleItems: this.renderedItems.length,
      scrollTop: this.scrollTop,
      visibleRange: this.visibleRange,
      totalHeight: this.getTotalHeight()
    };
  }
}

/**
 * Infinite Loader
 * Automatically loads more data as user scrolls
 */
class InfiniteLoader extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      threshold: 200, // Distance from bottom to trigger load
      initialPageSize: 20,
      pageSize: 20,
      debounceDelay: 100,
      ...options
    };

    this.items = [];
    this.loading = false;
    this.hasMore = true;
    this.page = 0;
    this.debounceTimer = null;
  }

  /**
   * Handle scroll
   */
  handleScroll(scrollTop, scrollHeight, clientHeight) {
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    if (distanceFromBottom < this.config.threshold && this.hasMore && !this.loading) {
      this.debouncedLoad();
    }
  }

  /**
   * Debounced load
   */
  debouncedLoad() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.loadMore();
    }, this.config.debounceDelay);
  }

  /**
   * Load more items
   */
  async loadMore() {
    if (this.loading || !this.hasMore) return;

    this.loading = true;
    this.emit('loading-start', { page: this.page });

    try {
      // Emit event for consumer to load data
      const result = await new Promise((resolve) => {
        this.emit('load-more', {
          page: this.page,
          pageSize: this.config.pageSize,
          resolve
        });
      });

      if (result && result.items) {
        this.items.push(...result.items);
        this.hasMore = result.hasMore !== false;
        this.page++;

        this.emit('loading-success', {
          items: result.items,
          totalItems: this.items.length
        });
      }
    } catch (error) {
      this.emit('loading-error', error);
    } finally {
      this.loading = false;
      this.emit('loading-end');
    }
  }

  /**
   * Reset
   */
  reset() {
    this.items = [];
    this.page = 0;
    this.hasMore = true;
    this.loading = false;
    this.emit('reset');
  }

  /**
   * Get items
   */
  getItems() {
    return this.items;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalItems: this.items.length,
      page: this.page,
      loading: this.loading,
      hasMore: this.hasMore
    };
  }
}

/**
 * Drag and Drop Manager
 */
class DragDropManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      dragThreshold: 5, // Pixels to move before drag starts
      dropEffect: 'move', // 'move', 'copy', 'link'
      ...options
    };

    this.dragging = false;
    this.dragData = null;
    this.dropZones = new Map();
    this.dragStartPos = null;
  }

  /**
   * Register drop zone
   */
  registerDropZone(id, options = {}) {
    this.dropZones.set(id, {
      id,
      accepts: options.accepts || ['*'],
      onDrop: options.onDrop,
      onDragOver: options.onDragOver,
      onDragEnter: options.onDragEnter,
      onDragLeave: options.onDragLeave
    });

    this.emit('dropzone-registered', id);
    return this;
  }

  /**
   * Unregister drop zone
   */
  unregisterDropZone(id) {
    const existed = this.dropZones.delete(id);
    if (existed) {
      this.emit('dropzone-unregistered', id);
    }
    return existed;
  }

  /**
   * Start drag
   */
  startDrag(data, options = {}) {
    this.dragging = true;
    this.dragData = {
      data,
      type: options.type || 'default',
      sourceId: options.sourceId,
      startTime: Date.now()
    };

    this.dragStartPos = options.position || { x: 0, y: 0 };

    this.emit('drag-start', this.dragData);
    return this;
  }

  /**
   * Update drag position
   */
  updateDragPosition(position) {
    if (!this.dragging) return this;

    const dx = position.x - this.dragStartPos.x;
    const dy = position.y - this.dragStartPos.y;

    this.emit('drag-move', {
      position,
      delta: { dx, dy }
    });

    return this;
  }

  /**
   * End drag
   */
  endDrag(dropZoneId = null) {
    if (!this.dragging) return this;

    const dragData = this.dragData;
    this.dragging = false;

    if (dropZoneId && this.dropZones.has(dropZoneId)) {
      const dropZone = this.dropZones.get(dropZoneId);

      // Check if drop is accepted
      if (this.canDrop(dragData.type, dropZone.accepts)) {
        if (dropZone.onDrop) {
          dropZone.onDrop(dragData);
        }

        this.emit('drop', {
          data: dragData,
          dropZoneId
        });
      } else {
        this.emit('drop-rejected', {
          data: dragData,
          dropZoneId
        });
      }
    } else {
      this.emit('drag-cancel', dragData);
    }

    this.dragData = null;
    this.dragStartPos = null;

    this.emit('drag-end');
    return this;
  }

  /**
   * Check if can drop
   */
  canDrop(dataType, accepts) {
    return accepts.includes('*') || accepts.includes(dataType);
  }

  /**
   * Get drag data
   */
  getDragData() {
    return this.dragData;
  }

  /**
   * Is dragging
   */
  isDragging() {
    return this.dragging;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      dragging: this.dragging,
      dropZones: this.dropZones.size,
      dragData: this.dragData
    };
  }
}

/**
 * Animation Controller
 */
class AnimationController extends EventEmitter {
  constructor() {
    super();

    this.animations = new Map();
    this.animationId = 0;
    this.running = false;
    this.rafId = null;
  }

  /**
   * Create animation
   */
  animate(options = {}) {
    const id = this.animationId++;

    const animation = {
      id,
      from: options.from || 0,
      to: options.to || 1,
      duration: options.duration || 300,
      easing: options.easing || this.easeInOutQuad,
      onUpdate: options.onUpdate,
      onComplete: options.onComplete,
      startTime: null,
      currentValue: options.from || 0
    };

    this.animations.set(id, animation);

    if (!this.running) {
      this.start();
    }

    this.emit('animation-created', id);
    return id;
  }

  /**
   * Cancel animation
   */
  cancel(id) {
    const existed = this.animations.delete(id);

    if (existed) {
      this.emit('animation-cancelled', id);

      if (this.animations.size === 0) {
        this.stop();
      }
    }

    return existed;
  }

  /**
   * Start animation loop
   */
  start() {
    if (this.running) return;

    this.running = true;
    this.tick();
  }

  /**
   * Stop animation loop
   */
  stop() {
    this.running = false;

    if (this.rafId) {
      clearTimeout(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Animation tick
   */
  tick() {
    if (!this.running) return;

    const now = Date.now();

    for (const [id, animation] of this.animations) {
      if (!animation.startTime) {
        animation.startTime = now;
      }

      const elapsed = now - animation.startTime;
      const progress = Math.min(elapsed / animation.duration, 1);

      const easedProgress = animation.easing(progress);
      animation.currentValue = animation.from + (animation.to - animation.from) * easedProgress;

      if (animation.onUpdate) {
        animation.onUpdate(animation.currentValue, progress);
      }

      this.emit('animation-update', {
        id,
        value: animation.currentValue,
        progress
      });

      if (progress >= 1) {
        if (animation.onComplete) {
          animation.onComplete(animation.to);
        }

        this.emit('animation-complete', id);
        this.animations.delete(id);
      }
    }

    if (this.animations.size > 0) {
      this.rafId = setTimeout(() => this.tick(), 16); // ~60fps
    } else {
      this.stop();
    }
  }

  /**
   * Easing functions
   */
  linear(t) {
    return t;
  }

  easeInQuad(t) {
    return t * t;
  }

  easeOutQuad(t) {
    return t * (2 - t);
  }

  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  easeInCubic(t) {
    return t * t * t;
  }

  easeOutCubic(t) {
    return --t * t * t + 1;
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      running: this.running,
      activeAnimations: this.animations.size
    };
  }

  /**
   * Destroy controller
   */
  destroy() {
    this.stop();
    this.animations.clear();
    this.removeAllListeners();
  }
}

/**
 * Gesture Recognizer
 */
class GestureRecognizer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      swipeThreshold: 50, // Minimum distance for swipe
      swipeTimeout: 300, // Maximum time for swipe
      tapTimeout: 200, // Maximum time for tap
      doubleTapDelay: 300, // Maximum delay between taps
      longPressDelay: 500, // Minimum time for long press
      pinchThreshold: 10, // Minimum distance for pinch
      ...options
    };

    this.touches = [];
    this.gestureStart = null;
    this.lastTap = null;
    this.longPressTimer = null;
  }

  /**
   * Handle touch start
   */
  handleTouchStart(touches) {
    this.touches = touches;
    this.gestureStart = {
      time: Date.now(),
      touches: touches.map((t) => ({ x: t.x, y: t.y }))
    };

    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      this.emit('long-press', {
        position: touches[0]
      });
    }, this.config.longPressDelay);

    this.emit('touch-start', { touches });
  }

  /**
   * Handle touch move
   */
  handleTouchMove(touches) {
    if (!this.gestureStart) return;

    // Cancel long press on move
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    this.touches = touches;

    // Detect pinch
    if (touches.length === 2 && this.gestureStart.touches.length === 2) {
      const currentDistance = this.getDistance(touches[0], touches[1]);
      const startDistance = this.getDistance(
        this.gestureStart.touches[0],
        this.gestureStart.touches[1]
      );

      const scale = currentDistance / startDistance;

      if (Math.abs(currentDistance - startDistance) > this.config.pinchThreshold) {
        this.emit('pinch', {
          scale,
          distance: currentDistance,
          center: this.getCenter(touches[0], touches[1])
        });
      }
    }

    this.emit('touch-move', { touches });
  }

  /**
   * Handle touch end
   */
  handleTouchEnd() {
    if (!this.gestureStart) return;

    // Clear long press timer
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    const duration = Date.now() - this.gestureStart.time;
    const touch = this.gestureStart.touches[0];
    const endTouch = this.touches[0];

    if (!endTouch) {
      this.gestureStart = null;
      return;
    }

    const dx = endTouch.x - touch.x;
    const dy = endTouch.y - touch.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Detect swipe
    if (distance > this.config.swipeThreshold && duration < this.config.swipeTimeout) {
      const direction = this.getSwipeDirection(dx, dy);
      this.emit('swipe', {
        direction,
        distance,
        velocity: distance / duration
      });
    }
    // Detect tap
    else if (duration < this.config.tapTimeout && distance < 10) {
      const now = Date.now();

      // Check for double tap
      if (this.lastTap && now - this.lastTap < this.config.doubleTapDelay) {
        this.emit('double-tap', { position: endTouch });
        this.lastTap = null;
      } else {
        this.emit('tap', { position: endTouch });
        this.lastTap = now;
      }
    }

    this.gestureStart = null;
    this.touches = [];

    this.emit('touch-end');
  }

  /**
   * Get distance between two points
   */
  getDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get center point between two points
   */
  getCenter(p1, p2) {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  }

  /**
   * Get swipe direction
   */
  getSwipeDirection(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeTouches: this.touches.length,
      gesturing: this.gestureStart !== null
    };
  }

  /**
   * Destroy recognizer
   */
  destroy() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }
    this.removeAllListeners();
  }
}

module.exports = {
  VirtualScroller,
  InfiniteLoader,
  DragDropManager,
  AnimationController,
  GestureRecognizer
};
