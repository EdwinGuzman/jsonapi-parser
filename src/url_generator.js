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
      function createSimpleKeyValString(key, val) {
        return '[' + key + ']=' + val + '&';
      }

      function createFilterRelationships(obj) {
        var query = '';
        for (var topKey in obj) {
          if (typeof obj[topKey] === 'object') {
            for (var secondKey in obj[topKey]) {
              query += 'filter[' + topKey + ']' + createSimpleKeyValString(secondKey, obj[topKey][secondKey]);
            }
          } else {
            query += 'filter' + createSimpleKeyValString(topKey, obj[topKey]);
          }
        }

        return query;
      }

      if (!filters) {
        return '';
      }

      return createFilterRelationships(filters);
    }
  };

  return urlGenerator;
}

module.exports = urlGenerator();
