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
          fieldParams = this.createFieldsParams(fields),
          sparseFields = fieldParams ? '&' + fieldParams : '';

      return '?' + this.createIncludesParams(includes) + sparseFields;
    }
  };

  return urlGenerator;
}

module.exports = urlGenerator();
