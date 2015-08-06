var http = require('http');
var Q = require('q');
var _ = require('underscore');
var urlGenerator = require('./url_generator.js');

var host = '',
	version = '',
	parser = {},
  childrenObjects = [],
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

function createRelationships(objectModel, relationships, children) {
  var includedDataObj = {},
      includedDataArray = [],
      linkageProperty = undefined,
      key = undefined,
      embeddedData = [];

  if (children && typeof children === 'string') {
    if (relationships.hasOwnProperty(children)) {
      linkageProperty = relationships[children]['data'];
      // If it contains a linkage object property
      if (linkageProperty) {
        _.each(linkageProperty, function (prop) {
          embeddedData.push(findInIncludes(prop));
        });
        if (embeddedData.length) {
          key = linkageProperty[0].type;
          objectModel[key] = embeddedData;
        } else {
          return {};
        }
      }
    }
  } else {
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

              if (includedDataObj.relationships) {
                _.each(childrenObjects, function (children) {
                  if (includedDataObj.relationships.hasOwnProperty(children)) {
                    createRelationships(includedDataObj, includedDataObj.relationships, children);
                  }
                });
              }

              objectModel[key] = includedDataObj;
            } else {
              makeHTTPRequest();
            }
          }
        }
      }
    }
  }

  return objectModel;
}

var call = function (opts, cb) {
  var data = null;

  var req = http.request(opts, function (res) {
    var responseString = '';
    res.setEncoding('utf8');

    res.on('data', function (chunk) {
      responseString += chunk;
    });

    res.on('end', function () {
      var result;

      try {
        result = JSON.parse(responseString);
      } catch (err) {
        return cb(err);
      }

      return cb(null, result);
    });
  });

  req.on('error', function (err) {
    return cb(err);
  });

  if (data !== null) {
    req.write(data);
  }
  req.end();
};

parser = {
	setHost: function setHost(options) {
		host = options.api_root;
		version = options.api_version

		return this;
	},
	get: function get(options, cb) {
    var deferred = Q.defer();
    var endpoint = options.endpoint,
      included = urlGenerator.createParams(options),
      opts = {
        host: host,
        path: endpoint + included,
        method: 'GET',
      };

    _.each(options.includes, function (include) {
      var embedded = include.indexOf('.');
      if (embedded !== -1)  {
        childrenObjects.push(include.substr(embedded + 1));
      }
    });

    var data = null;

    var req = http.request(opts, function (res) {
      var responseString = '';
      res.setEncoding('utf8');

      res.on('data', function (chunk) {
        responseString += chunk;
      });

      res.on('end', function () {
        var result;

        try {
          result = JSON.parse(responseString);
        } catch (err) {
          deferred.reject(err);
        }

        deferred.resolve(result);
      });
    });

    req.on('error', function (err) {
      deferred.reject(err);
    });

    if (data !== null) {
      req.write(data);
    }
    req.end();

    deferred.promise.nodeify(cb);
    return deferred.promise;
  },
  getOfType: function getOfType() {
    var included = arguments[0] === undefined ? [] : arguments[0];
    var type = arguments[1] === undefined ? '' : arguments[1];
    var flatArr = undefined;

    if (!included || !type) {
      return;
    }

    getObjectsOfType = findTypesGenerator(included);
    flatArr = getObjectsOfType(type);

    return flatArr;
  },
  createHierarchy: function createHierarchy() {
    var included = arguments[0] === undefined ? [] : arguments[0];
    var type = arguments[1] === undefined ? '' : arguments[1];

    var parents = [],
        flatArr = undefined,
        parentObj = undefined,
        parentAlreadyAdded = undefined;

    if (!included || !type) {
      return;
    }

    getObjectsOfType = findTypesGenerator(included);
    findInIncludes = includedGenerator(included);
    flatArr = getObjectsOfType(type);

    _.each(flatArr, function (obj) {
      if (obj.relationships && obj.relationships.parent) {
        parentObj = findInIncludes(obj.relationships.parent.data);

        // found parent in the included array
        if (parentObj) {
          parentAlreadyAdded = _.findWhere(parents, { id: parentObj.id });

          // If the parent object doesn't have a children array, add it
          if (!parentObj.children) {
            parentObj.children = [];
          }

          if (!_.findWhere(parentObj.children, { id: obj.id })) {
            parentObj.children.push(obj);
          }

          // Check to see if the parent object already exists
          // in the parents array
          if (!parentAlreadyAdded) {
            parents.push(parentObj);
          }
        }
      } else {
        parentAlreadyAdded = _.findWhere(parents, { id: obj.id });
        if (!parentAlreadyAdded) {
          parents.push(obj);
        }
      }
    });

    return parents;
  }
};

module.exports = parser;

