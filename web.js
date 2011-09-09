var http  = require('http'),
    https = require('https'),
    path  = require('path'),
    url   = require('url'),
    express = require('express');

(function(filepath) {
    var env, key;
    if (path.existsSync(filepath)) {
        env = JSON.parse(require('fs').readFileSync(filepath, 'utf-8'));
        for (key in env) process.env[key] = env[key];
    }
}('devenv.json'));

var ACCESS_TOKEN = process.env.GLISTAGRAM_API_KEY;
console.log('ACCESS_TOKEN', ACCESS_TOKEN);

var app = express.createServer();

app.get('/', function(req, res) {
    res.sendfile('views/index.html');
});
app.get('/public/*', function(req, res) {
    res.sendfile('.' + req.url);
});

app.get('/search/*', function(req, res) {
    var query, medialist,
        options,
        i, imax;
    
    medialist = [];
    function sendResult() {
        var i, imax;
        for (i = 0, imax = medialist.length; i < imax; i++) {
            medialist[i] = '"' + medialist[i] + '"';
        }
        res.send("[" + medialist.join(",") + "]");
    }
    
    function buildMedialist(path) {
        if (path.indexOf('?') == -1) {
            path += '?access_token=' + ACCESS_TOKEN;
        } else {
            path += '&access_token=' + ACCESS_TOKEN;
        }
        
        https.get({ host: 'api.instagram.com', path: path }, function(result) {
            var body, data, i, imax;
            if (result.statusCode == 200) {
                body = [];
                result.on('data', function(chunk) {
                    body.push(chunk);
                });
                result.on('end', function() {
                    data = eval('(' + body.join('') + ')')['data'];
                    for (i = 0, imax = data.length; i < imax; i++) {
                        medialist.push(data[i]['images']['low_resolution']['url']);
                    }
                    sendResult();
                });
            } else {
                console.log("bad status", result.statusCode);
                sendResult();
            }
        });
    };
    
    query = unescape(req.url.substring(8).trim());
    if (query == '') {
        buildMedialist('/v1/media/popular');
    } else if (query.match('^#?[0-9a-zA-Z]+$')) {
        if (query[0] == '#') {
            query = query.substring(1);
            buildMedialist('/v1/tags/' + query + '/media/recent?count=50');
        } else {
            https.get({
                host: 'api.instagram.com',
                path: '/v1/users/search?q=' + query + '&access_token=' + ACCESS_TOKEN
            }, function (result) {
                var body, data, i, imax;
                if (result.statusCode == 200) {
                    body = [];
                    result.on('data', function(chunk) {
                        body.push(chunk);
                    });
                    result.on('end', function() {
                        var isFind = false;
                        data = eval('(' + body.join('') + ')')['data'];
                        for (i = 0, imax = data.length; i < imax; i++) {
                            if (data[i].username == query) {
                                isFind = true;
                                buildMedialist('/v1/users/' + data[i].id + '/media/recent?count=50');
                                break;
                            }
                        }
                        if (! isFind) {
                            console.log("not found");
                        }
                    });
                } else {
                    console.warn("request error?", result.statusCode);
                }
            });
        }
    } else {
        console.warn('invalid query?', query);    
    }
});

var cache = {}, Q = [], Q_SIZE = 256;
app.get('/image/*', function(req, res) {
    var uri, target;
    
    function sendResult(image) {
        res.writeHead(200, {
            'Content-Length': image.length,
            'Content-Type': 'image/jpeg'
        });
        res.end(image);
    }
    
    uri = req.url.substring(7);
    if (uri.match('^http://.+?/media/\\d{4}/\\d{2}/\\d{2}/[0-9a-f]+_\\d.jpg$')) {
        if (uri in cache) {
            sendResult(cache[uri]);
        } else {
            target = url.parse(uri);
            http.get(
                { host:target.hostname, path:target.pathname },
                function(result) {
                    var body;
                    if (result.statusCode == 200) {
                        body = [];
                        result.setEncoding('binary');
                        result.on('data', function(chunk) {
                            body.push(chunk);
                        });
                        result.on('end', function() {
                            var image = new Buffer(body.join(''), 'binary');
                            sendResult(image);
                            
                            cache[uri] = image;
                            Q.push(uri);
                            if (Q.length >= Q_SIZE) {
                                delete cache[Q.shift()];
                            }
                        });
                    }
                });
        }
    } else {
        console.error('unknown url??', uri);
    }
});


app.listen(process.env.PORT || 3000);
