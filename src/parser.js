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

function createArrayModels(data, includes) {
  var dataModels = [];

  if (data.length) {
    dataModels = _.map(data, function (d) {
      return createObjectModel(d, includes);
    });
  }

  return dataModels;
}

function createObjectModel() {
  var data = arguments[0] === undefined ? {} : arguments[0];
  var includes = arguments[1] === undefined ? {} : arguments[1];

  var objectModel = data,
      relationships = objectModel.relationships;

  objectModel = createRelationships(objectModel, relationships, includes);

  return objectModel;
}

function makeHTTPRequest() {}

function constructObjFromIncluded(linkageProperty, relIncluded) {
  var dataObj;

  dataObj = findInIncludes(linkageProperty) || {};

  if (dataObj && dataObj.relationships && relIncluded.children.length) {
    dataObj = createRelationships(dataObj, dataObj.relationship, relIncluded.children);
  }

  return dataObj;
}

function constructArrayFromIncluded(linkageProperty, relIncluded) {
  var includedDataArray = [],
      dataObj = {};

  // Loop through each object in the array and find the
  // corresponding data from the included array.
  _.each(linkageProperty, function (linkageProp) {
    dataObj = constructObjFromIncluded(linkageProp, relIncluded);

    if (!_.isEmpty(dataObj)) {
      if (dataObj.relationships && relIncluded.children.length) {
        dataObj = createRelationships(dataObj, dataObj.relationships, relIncluded.children);
      }
      includedDataArray.push(dataObj);
    } else {
      makeHTTPRequest();
    }
  });

  return includedDataArray;
}

function createRelationships(objectModel, relationships, includes) {
  var includedDataObj = {},
      includedDataArray = [],
      linkageProperty = undefined,
      key = undefined,
      embeddedData = [];

  var relationshipsToTest = [];
  _.each(includes, function (include) {
    var relationship = {
      top: '',
      children: []
    };

    var firstPeriod = include.indexOf('.');
    if (firstPeriod !== -1) {
      var top = include.substring(0, firstPeriod);
      var alreadyExisting = _.findWhere(relationshipsToTest, {top: top});

      if (alreadyExisting) {
        alreadyExisting.children.push(include.substring(firstPeriod+1));
      }
      else {
        relationship.top = top;
        relationship.children.push(include.substring(firstPeriod+1));
        relationshipsToTest.push(relationship);
      }
    } else {
      relationship.top = include;
      relationshipsToTest.push(relationship);
    }
  });

  for (var rel in relationships) {
    var relIncluded = _.findWhere(relationshipsToTest, {top: rel})
    if (relationships.hasOwnProperty(rel) && relIncluded) {

      linkageProperty = relationships[rel]['data'];

      // If it contains a linkage object property
      if (linkageProperty) {
        if (Array.isArray(linkageProperty)) {
          // All have the same type but only need to get it from one object
          key = linkageProperty[0].type;

          includedDataArray = constructArrayFromIncluded(linkageProperty, relIncluded);

          if (includedDataArray.length) {
            // return the data in an array.
            objectModel[rel] = includedDataArray;
          }
        } else {
          includedDataObj = constructObjFromIncluded(linkageProperty, relIncluded);

          if (includedDataObj) {
            key = linkageProperty.type;

            if (includedDataObj.relationships && relIncluded.children.length) {
              createRelationships(
                includedDataObj,
                includedDataObj.relationships,
                relIncluded.children
              );
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
    var arr = [];
    _.each(options.includes, function (include) {
      if (!_.contains(arr, include)) {
        arr.push(include);
      }
    });

    return arr;
  },
  getCompleteApi: function getCompleteApi(options, extraParams) {
    var params = extraParams || '';
    return options.endpoint + urlGenerator.createParams(options) + params;
  },
  parse: function parse() {
    var apiData = arguments[0] === undefined ? {} : arguments[0],
      opts = arguments[1] === undefined ? {} : arguments[1];

    var data = apiData.data,
        included = apiData.included ? apiData.included : [],
        processedData = undefined;

    var includes = this.setChildrenObjects(opts);

    findInIncludes = findInArray(included);

    // The data is an array if we are fetching multiple objects
    if (Array.isArray(data)) {
      processedData = createArrayModels(data, includes);
    } else {
      // If we are fetching one specific profile, then it is
      // simply an object, per the JSON API docs.
      processedData = createObjectModel(data, includes);
    }

    childrenObjects = [];

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
