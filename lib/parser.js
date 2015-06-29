var http = require('http');
var _ = require('underscore');
var urlGenerator = require('./url_generator.js');

var host = '',
	version = '',
	parser = {},
	findInIncludes = undefined,
  getObjectsOfType = undefined;

function includedGenerator() {
  var included = arguments[0] === undefined ? [] : arguments[0];

  return function (data) {
    return _.findWhere(included, {
      'id': data.id,
      'type': data.type
    });
  };
};

function findTypesGenerator() {
  var included = arguments[0] === undefined ? [] : arguments[0];

  return function (type) {
    return included.filter(function (obj) {
      return obj.type === type;
    });
  };
}

function createArrayModels(data) {
  var dataModels = [];

  if (data.length) {
    dataModels = data.map(createObjectModel);
  }

  return dataModels;
}

function createObjectModel() {
  var data = arguments[0] === undefined ? {} : arguments[0];

  var objectModel = data,
      relationships = objectModel.relationships;

  objectModel = createRelationships(objectModel, relationships);

  return objectModel;
}

function makeHTTPRequest() {}

function constructObjFromIncluded(linkageProperty) {
  var dataObj = {};

  dataObj = findInIncludes(linkageProperty);

  if (dataObj && dataObj.relationships) {
    dataObj = createRelationships(dataObj, dataObj.relationship);
  }

  return dataObj;
}

function constructArrayFromIncluded(linkageProperty) {
  var includedDataArray = [],
      dataObj = {};

  // Loop through each object in the array and find the
  // corresponding data from the included array.
  linkageProperty.each(function (linkageProp) {
    dataObj = constructObjFromIncluded(linkageProp);

    if (dataObj) {
      if (dataObj.relationships) {
        dataObj = createRelationships(dataObj, dataObj.relationships);
      }
      includedDataArray.push(dataObj);
    } else {
      makeHTTPRequest();
    }
  });

  return includedDataArray;
}

function createRelationships(objectModel, relationships) {
  var includedDataObj = {},
      includedDataArray = [],
      linkageProperty = undefined,
      key = undefined;

  for (var rel in relationships) {
    if (relationships.hasOwnProperty(rel)) {
      linkageProperty = relationships[rel]['data'];

      // If it contains a linkage object property
      if (linkageProperty) {
        if (Array.isArray(linkageProperty)) {
          // All have the same type but only need to get it from one object
          key = linkageProperty[0].type;

          includedDataArray = constructArrayFromIncluded(linkageProperty);

          if (includedDataArray.length) {
            // return the data in an array.
            objectModel[key] = includedDataArray;
          }
        } else {
          includedDataObj = constructObjFromIncluded(linkageProperty);

          if (includedDataObj) {
            key = linkageProperty.type;
            objectModel[key] = includedDataObj;
          } else {
            makeHTTPRequest();
          }
        }
      }
    }
  }

  return objectModel;
}

parser = {
	setHost: function setHost(options) {
		host = options.api_root;
		version = options.api_version

		return this;
	},
	get: function get(options, success) {
		var endpoint = options.endpoint,
			included = urlGenerator.createParams(options),
			options = {
				host: host,
				path: endpoint + included,
				method: 'GET',
			},
			req;

		req = http.request(options, function (res) {
			var responseString = '';

			res.setEncoding('utf-8');
			res.on('data', function (data) {
				responseString += data;
			});
			res.on('end', function () {
				var responseObject = JSON.parse(responseString);
				success(responseObject);
			});
		});

		req.end();
	},
	test: function () {
		console.log('test');
	},
	parse: function parse() {
    var apiData = arguments[0] === undefined ? {} : arguments[0];

    var data = apiData.data,
        included = apiData.included ? apiData.included : [],
        processedData = undefined;

    findInIncludes = includedGenerator(included);

    // The data is an array if we are fetching multiple objects
    if (Array.isArray(data)) {
      processedData = createArrayModels(data);
    } else {
      // If we are fetching one specific profile, then it is
      // simply an object, per the JSON API docs.
      processedData = createObjectModel(data);
    }

    return processedData;
  }
};

module.exports = parser;

