var RockShot = (function () {

  var VERSION_MAJOR = 0;
  var VERSION_MINOR = 6;

  return {

    init: function (appId) {
      this.appId = appId;
      this.shotInfo = {
        width: 0,
        height: 0
      };

      this.updateScreenshot = updateScreenshot.bind(this);
      this.startScreenshot = startScreenshot.bind(this);
      this.requestScreenshot = requestScreenshot.bind(this);
      this.uploadScreenshot = uploadScreenshot.bind(this);
      this.connectToFirebase = connectToFirebase.bind(this);
      this.screenshot = null;

      Pebble.addEventListener('ready', onReady.bind(this));
      Pebble.addEventListener('appmessage', onAppMessage.bind(this));
    },

    captureSingle: function () {
      this.requestScreenshot();
    },

    validPayload: function (payload) {
      return isValidPayload(payload);
    },

    getVersion: function () {
      return VERSION_MAJOR + '.' + VERSION_MINOR;
    }

  };

  function onReady(e) {
    var ready = e.ready;
    if (! ready) {
      return;
    }
    console.log('RockShot v' + VERSION_MAJOR + '.' + VERSION_MINOR + ' is ready.');
    this.connectToFirebase();
  }

  function onAppMessage(e) {
    var validPayload = isValidPayload(e.payload);
    if (! validPayload) {
      return;
    }
    var header = getPayloadHeader(e.payload);
    var offset = parseInt(header[0], 10);
    var chunk_size = parseInt(header[1], 10);
    var total_size = parseInt(header[2], 10);

    if (offset === 0) {
      this.startScreenshot(total_size);
      this.shotInfo.width = parseInt(header[3], 10);
      this.shotInfo.height = parseInt(header[4], 10);
    }
    this.updateScreenshot(offset, getPayloadData(e.payload));
    if (offset + chunk_size >= total_size) {
      this.uploadScreenshot();
    }
  }

  function requestScreenshot() {
    Pebble.sendAppMessage({
      '76250': 'single'
    });
  }

  function connectToFirebase() {
    var self = this;
    var rockshotRoot = new Firebase('https://pblweb.firebaseIO.com/rockshot/' + this.appId);
    rockshotRoot.auth('6g26Op4aTanqxoL7eU0ZiYcUviGKGQHVFI48iI8B');

    var rockshotStatus = rockshotRoot.child('status');
    rockshotStatus.set('connected');
    rockshotStatus.onDisconnect().set('disconnected');

    var rockshotRequests = rockshotRoot.child('request');
    rockshotRequests.on('value', function (snapshot) {
      var request = snapshot.val();
      if (request === 'single') {
        rockshotRoot.update({ request: '' });
        self.requestScreenshot();
      }
    });
  }

  function uploadScreenshot() {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://rockshot.pblweb.com/screenshot', true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.onload = function () {
    };
    xhr.send('data=' + this.screenshot.join(',') + '&width=' + this.shotInfo.width + '&height=' + this.shotInfo.height + '&app=' + this.appId);
  }

  function startScreenshot(size) {
    this.screenshot = [];
  }

  function updateScreenshot(offset, data) {
    this.screenshot = this.screenshot.concat(data);
  }

  function isValidPayload(payload) {
    if (payload.rockshot_header || payload.rockshot_data) {
      return (payload.rockshot_header && payload.rockshot_data) ? true : false;
    }
    return (payload['76250'] && payload['76251']) ? true : false;
  }

  function getPayloadHeader(payload) {
    if (payload.rockshot_header) {
      return payload.rockshot_header.split('|');
    }
    return payload['76250'].split('|');
  }

  function getPayloadData(payload) {
    return payload.rockshot_data || payload['76251'];
  }

}());
