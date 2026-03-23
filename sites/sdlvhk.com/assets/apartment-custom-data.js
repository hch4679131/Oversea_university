(function initApartmentCustomData(factory) {
  const data = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = data;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.SDLV_CUSTOM_APARTMENTS = data;
  }
}(function buildApartmentCustomData() {
  return {};
}));