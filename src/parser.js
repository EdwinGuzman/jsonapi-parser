var http = require('http');
var _ = require('underscore');
var urlGenerator = require('./url_generator.js');

var host = '',
  version = '',
  parser = {},
  childrenObjects = [],
  findInIncludes = undefined,
  getObjectsOfType = undefined;


// used for included but also only when data is an array
function findInArray() {
  var arr = arguments[0] === undefined ? [] : arguments[0];

  return function (data) {
    return _.findWhere(arr, {
      'id': data.id,
      'type': data.type
    });
  };
}

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
  _.each(linkageProperty, function (linkageProp) {
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
            objectModel[rel] = includedDataArray;
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

            objectModel[rel] = includedDataObj;
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
  setChildrenObjects: function setChildrenObjects(options) {
    _.each(options.includes, function (include) {
      var children = include.split('.');
      _.each(children, function (child) {
        childrenObjects.push(child);
      });
    });

    return this;
  },
  get: function get(options, cb) {
    var endpoint = options.endpoint,
      included = urlGenerator.createParams(options),
      opts = {
        host: host,
        path: endpoint + included,
        method: 'GET',
      };

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
          console.log(err);
        }
        return cb(result);
      });
    });

    req.on('error', function (err) {
      console.log(err);
    });

    if (data !== null) {
      req.write(data);
    }
    return req.end();
  },
  parse: function parse() {
    var apiData = arguments[0] === undefined ? {} : arguments[0];

    var data = apiData.data,
        included = apiData.included ? apiData.included : [],
        processedData = undefined;

    findInIncludes = findInArray(included);

    // The data is an array if we are fetching multiple objects
    if (Array.isArray(data)) {
      processedData = createArrayModels(data);
    } else {
      // If we are fetching one specific profile, then it is
      // simply an object, per the JSON API docs.
      processedData = createObjectModel(data);
    }

    return processedData;
  },
  getOfType: function getOfType() {
    var included = arguments[0] === undefined ? [] : arguments[0];
    var type = arguments[1] === undefined ? '' : arguments[1];
    var flatArr = undefined;

    if (!included || !type) {
      return;
    }

    flatArr = this.getObjectsOfType(included)(type);

    return flatArr;
  },
  getObjectsOfType: function getObjectsOfType(included) {
    var getObjectsOfType = findTypesGenerator(included);
    return function (type) {
      return getObjectsOfType(type);
    };
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

    flatArr = this.getObjectsOfType(included)(type);

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

