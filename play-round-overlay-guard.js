(() => {
  'use strict';

  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!descriptor?.set || !descriptor?.get) return;

  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set(value) {
      try {
        if (
          this instanceof HTMLElement &&
          this.id === 'overlayRanking' &&
          String(value ?? '') === '' &&
          !document.getElementById('roundOverlay')?.hidden &&
          this.querySelector('.hub-managed-round-row')
        ) {
          // play.js may initialize the same finalized round after the managed
          // renderer has already started. Keep the single managed renderer's
          // board instead of briefly replacing it with an empty result area.
          return;
        }
      } catch (_) {}
      return descriptor.set.call(this, value);
    }
  });
})();
