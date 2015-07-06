JSONAPI Parser

```javascript
var parser = require('jsonapi-parserinator'),
  options = {
    endpoint: '/api/bikes',
    includes: ['item', 'list']
  },
  data;

parser
  .setHost({
    api_root: 'yourapi.com',
    api_version: 'v0.1'
  })
  .get(options, function (apiData) {
    data = apiData;
    var parsedData = parser.parse(data);
    console.log(parsedData);
  });
```

### Parserinator
At NYPL we have been adding the -inator suffix to our applications. Check out
* [Locinator](http://nypl.org/locations)
* [Researchinator](http://nypl.org/research-divisions)
* [Staffinator](http://nypl.org/staff-profiles)

This JSONAPI parser is based on an [AngularJS JSONAPI parser](https://github.com/EdwinGuzman/parserinator) which was used for the Staffinator, except that this is a node module with the intent to use it for many different Javascript frameworks and not just AngularJS.
