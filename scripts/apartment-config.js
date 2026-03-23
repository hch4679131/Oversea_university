const {
  getApartmentPages,
  buildApartmentSlugs,
  buildApartmentMeta,
  getApartmentTemplate
} = require('../sites/sdlvhk.com/assets/apartment-data');

module.exports = {
  apartmentConfigs: getApartmentPages(),
  buildApartmentSlugs,
  buildApartmentMeta,
  getApartmentTemplate
};