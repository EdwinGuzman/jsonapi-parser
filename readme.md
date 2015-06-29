JSONAPI Parser

```javascript
var parser = require('./lib/parser'),
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