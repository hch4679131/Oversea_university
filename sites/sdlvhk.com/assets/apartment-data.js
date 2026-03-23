(function initApartmentData(globalFactory) {
  const api = globalFactory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.SDLV_APARTMENTS = api;
    globalThis.buildApartmentState = api.buildApartmentState;
    globalThis.getApartmentPage = api.getApartmentPage;
    globalThis.getApartmentPageKeys = api.getApartmentPageKeys;
    globalThis.getApartmentLocalizedTitle = api.getApartmentLocalizedTitle;
  }
}(function buildApartmentApi() {
  const store = typeof require === 'function'
    ? require('./apartment-store')
    : (globalThis.SDLV_APARTMENT_STORE || { apartmentPages: {} });

  const PUBLIC_AREA_LABEL = '公共区域';

  function getApartmentPages() {
    return store.apartmentPages || {};
  }

  function getApartmentPage(pageKey) {
    return getApartmentPages()[pageKey] || null;
  }

  function getApartmentPageKeys() {
    if (typeof store.getApartmentPageKeys === 'function') {
      return store.getApartmentPageKeys();
    }

    return Object.keys(getApartmentPages());
  }

  function clonePhoto(photo) {
    return { ...photo };
  }

  function clonePhotoList(photos) {
    return Array.isArray(photos) ? photos.map(clonePhoto) : [];
  }

  function buildApartmentSlugs() {
    return Object.fromEntries(
      Object.entries(getApartmentPages()).map(([pageKey, apartment]) => [pageKey, apartment.slug])
    );
  }

  function buildApartmentMeta() {
    return Object.fromEntries(
      Object.entries(getApartmentPages()).map(([pageKey, apartment]) => [pageKey, apartment.meta])
    );
  }

  function buildApartmentTitleKeys() {
    return Object.fromEntries(
      Object.entries(getApartmentPages()).map(([pageKey, apartment]) => [pageKey, apartment.titleKey])
    );
  }

  function getApartmentTemplate(pageKey) {
    return getApartmentPage(pageKey) ? 'ymt-shared' : null;
  }

  function getApartmentLocalizedTitle(pageKey, lang, translations) {
    const apartment = getApartmentPage(pageKey);
    if (!apartment) {
      return '';
    }

    if (translations && apartment.titleKey && translations[apartment.titleKey]) {
      return translations[apartment.titleKey];
    }

    if (apartment.meta && apartment.meta[lang] && apartment.meta[lang].title) {
      return apartment.meta[lang].title.replace(/\s*\|.*$/, '');
    }

    return apartment.displayName || '';
  }

  function groupApartmentPhotos(photos) {
    const buckets = {};
    const publicPhotos = [];

    clonePhotoList(photos).forEach((photo) => {
      if (photo.label === PUBLIC_AREA_LABEL) {
        publicPhotos.push(photo);
        return;
      }

      if (!buckets[photo.label]) {
        buckets[photo.label] = { label: photo.label, photos: [] };
      }

      buckets[photo.label].photos.push(photo);
    });

    return {
      groupedRooms: Object.values(buckets),
      publicPhotos
    };
  }

  function buildApartmentState(pageKey) {
    const apartment = getApartmentPage(pageKey);

    if (!apartment) {
      throw new Error(`Unknown apartment page key: ${pageKey}`);
    }

    const grouped = groupApartmentPhotos(apartment.rooms && apartment.rooms.photos);
    const slides = {};
    grouped.groupedRooms.forEach((_, index) => {
      slides[index] = 0;
    });

    return {
      pageKey,
      groupedRooms: grouped.groupedRooms,
      publicPhotos: grouped.publicPhotos,
      roomSlides: slides,
      bookingOpen: false
    };
  }

  function createApartmentRecord(payload) {
    const pageKey = payload.pageKey || `apartment-${payload.slug}`;
    return {
      pageKey,
      slug: payload.slug ? `apartments/${payload.slug}` : '',
      titleKey: payload.titleKey || `${pageKey.replace(/-/g, '_')}_title`,
      displayName: payload.displayName || '',
      meta: payload.meta || {
        sc: { title: payload.displayName || '', description: '' },
        tc: { title: payload.displayName || '', description: '' },
        en: { title: payload.displayName || '', description: '' }
      },
      hero: {
        badge: payload.hero && payload.hero.badge ? payload.hero.badge : null,
        locationLine: payload.hero && payload.hero.locationLine ? payload.hero.locationLine : null,
        mapImage: payload.hero && payload.hero.mapImage ? payload.hero.mapImage : null,
        showInteractiveMap: Boolean(payload.hero && payload.hero.showInteractiveMap)
      },
      transport: {
        sectionTitle: '交通出行',
        sectionSubtitle: '周边大学通勤时间 / 主要交通节点',
        cards: Array.isArray(payload.transport && payload.transport.cards) ? payload.transport.cards : []
      },
      rooms: {
        sectionTitle: '我们的房间',
        sectionSubtitle: '软硬件设施一览 / 生活与学业支持服务',
        publicAreaHeading: '公共区域',
        photos: Array.isArray(payload.rooms && payload.rooms.photos) ? payload.rooms.photos : []
      },
      booking: {
        enabled: Boolean(payload.booking && payload.booking.enabled),
        ctaText: payload.booking && payload.booking.ctaText ? payload.booking.ctaText : '抢先以早鸟价格订房',
        modalTitle: payload.booking && payload.booking.modalTitle ? payload.booking.modalTitle : '立即预定',
        modalDescription: payload.booking && payload.booking.modalDescription ? payload.booking.modalDescription : '请扫描二维码，立即预定房间!',
        qrCode: payload.booking && payload.booking.qrCode ? payload.booking.qrCode : store.bookingQrCode,
        excludeLabels: Array.isArray(payload.booking && payload.booking.excludeLabels) ? payload.booking.excludeLabels : ['公共区域']
      },
      lifestyleCards: Array.isArray(payload.lifestyleCards) ? payload.lifestyleCards : [],
      amenityGroups: Array.isArray(payload.amenityGroups) ? payload.amenityGroups : [],
      floorPlans: Array.isArray(payload.floorPlans) ? payload.floorPlans : []
    };
  }

  function addApartmentPage(apartmentRecord, options) {
    if (typeof store.addApartmentPage !== 'function') {
      throw new Error('Apartment store does not support adding pages in this environment.');
    }

    return store.addApartmentPage(apartmentRecord, options);
  }

  return {
    PUBLIC_AREA_LABEL,
    getApartmentPages,
    getApartmentPage,
    getApartmentPageKeys,
    buildApartmentSlugs,
    buildApartmentMeta,
    buildApartmentTitleKeys,
    getApartmentTemplate,
    getApartmentLocalizedTitle,
    groupApartmentPhotos,
    buildApartmentState,
    createApartmentRecord,
    addApartmentPage
  };
}));