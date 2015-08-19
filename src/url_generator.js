var _ = require('underscore');

function urlGenerator() {
  var urlGenerator = {
    createIncludesParams: function createIncludesParams(includes) {
      return includes ? 'include=' + includes.join(',') : '';
    },
    createFieldsParams: function createFieldsParams(fields) {
      var fieldsArray = [],
          field = undefined;

      if (!fields) {
        return '';
      }

      for (field in fields) {
        if (fields.hasOwnProperty(field)) {
          fieldsArray.push('fields[' + field + ']=' + fields[field].join(','));
        }
      }

      return fieldsArray.join('&');
    },
    createParams: function createParams() {
      var opts = arguments[0] === undefined ? {} : arguments[0];

      var includes = opts.includes,
          fields = opts.fields,
          filters = opts.filters,
          filterParams = this.createFilters(filters)
          fieldParams = this.createFieldsParams(fields),
          filterQuery = filterParams ? filterParams : '';
          sparseFields = fieldParams ? '&' + fieldParams : '';

      return '?' + filterQuery + this.createIncludesParams(includes) + sparseFields;
    },
    // quick implementation
    createFilters: function createFilters(filters) {
      if (!filters) {
        return '';
      }

      var filterQuery = 'filter';
      var query = '';
      var filterLoop = filters;

      if (filters.relationships) {
        filterQuery += '[relationships]';
        filterLoop = filters.relationships;
      }

      for (var rel in filterLoop) {
        query = filterQuery + '[' + rel + ']=' + filterLoop[rel];
        query += '&'
      }

      return query;
    }
  };

  return urlGenerator;
}

module.exports = urlGenerator();
