window.onload = function() {
    
    var WIDTH = 480, HEIGHT = 320,
        MOVE_TABLE = [-4, -2, -2, -1, -1, 0, 1, 1, 2, 2, 4],
        SIZE_TABLE = [320,480,640,720,960],
        RESIZE_TABLE = [-24, -16, -8, -4, -4, -2, -2, 0, 0, 2, 2, 4, 4, 8, 16, 24];
    
    function randint(a, b) {
        return ((Math.random()*(b-a+1))+a) | 0;
    };
    
    function choice(lst) {
        return lst[(Math.random() * lst.length)|0];
    };
    
    function image(data) {
        return ['data:image/jpeg;base64,',
                btoa(data.replace(/[\u0100-\uffff]/g, function(c) {
                    return String.fromCharCode(c.charCodeAt(0) & 0xFF);
                }))].join('');
    }
    
    var glitch = (function() {
        var fromCharCode = String.fromCharCode,
            i, randtable = [];
        for (i = 0; i < 4096; i++) {
            randtable[i] = randint(0, 9);
        }
        
        return function(src, gain) {
            if (gain <= 0) {
                return src;
            } else if (10 <= gain) {
                return src.replace(/0/ig, function(c) {
                        return fromCharCode(48 + randtable[i++&4095]);
                });
            } else {
                return src.replace(/0/ig, function(c) {
                    if (randtable[i++&4095] < gain) {
                        return fromCharCode(48 + randtable[i++&4095]);
                    } else {
                        return c;
                    }
                });
            }
        };
    }());
    
    var GlitchPlayer = function(canvas, fps) {
        this.fps = fps;
        this.urls = [];
        this.isPlaying = false;
        this.gain = 8;
        this.bpm = 120;
        
        this._ctx = canvas.getContext('2d');
        this._ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        
        this._image = [];
        for (var i = 0; i < 16; i++) {
            this._image[i] = document.createElement('img');
            $(this._image[i]).load(
                (function(self, ctx, image) {
                    return function() {
                        var size = self._s,
                            resize = choice(RESIZE_TABLE);
                        
                        size += resize;
                        if (size < 320) {
                            size = 320;
                        }
                        self._x += choice(MOVE_TABLE) + resize/-2;
                        self._y += choice(MOVE_TABLE) + resize/-2;
                        
                        ctx.fillRect(0, 0, WIDTH, HEIGHT);
                        ctx.drawImage(image, self._x, self._y, size, size);
                        self._s = size;
                    };
                }(this, this._ctx, this._image[i])));
        }
        this._prevTime = 0;
        this._timerId = 0;
        this._imagePool = {};
        this._orig = null;
        
        this._query  = '';
        this._pquery = '*';
        
        this._i = this._s = this._x = this._y = 0;
    };
    
    GlitchPlayer.prototype.seturls = function(urls) {
        this.urls = urls;
        this._reloadImage();
    };
    
    GlitchPlayer.prototype.setq = function(q) {
        if (q == '' || q.match('^#?[0-9a-zA-Z]+$')) {
            this._query = q;    
        } else {
            this._query = null;
        }
    };
    
    GlitchPlayer.prototype.start = function() {
        var self = this,
            query;
        
        function _start() {
            var waitTimerId;
            if (self.isPlaying && self._timerId == 0) {
                if (! self.urls) self._reloadImage();
                waitTimerId = setInterval(function() {
                    if (self._orig) {
                        self._prevTime = new Date().getTime();
                        self._timerId = setInterval(function() {
                            self._view();    
                        }, 1000/self.fps);
                        clearInterval(waitTimerId);
                    } else if (! self.isPlaying) {
                        clearInterval(waitTimerId);
                    }
                }, 100);
            }
        }
        
        if (! player.isPlaying) {
            if (this._query == null) {
                message('err', 'bad query');
            } else if (this._query == this._pquery) {
                if (player.urls.length == 0) {
                    message('warn', 'oops! could not found any photos.');
                } else {
                    $('#tips').show();
                    $('#main').fadeOut('slow', function() {
                        _start();
                    });
                }
            } else {
                query = (this._query == '') ? 'popular' : this._query;
                message('load', 'now loading... (cancel:space)');
                $.get('/api/search/' + escape(query), function(res) {
                    var result, urls;
                    if (self.isPlaying) {
                        result = eval('(' + res + ')');
                        if (result.status == 200) {
                            urls = result.urls;
                            if (urls.length == 0) {
                                message('warn', 'oops! could not found any photos.');
                            } else {
                                self.seturls(urls);
                                $('#tips').show();
                                $('#main').fadeOut('slow', function() {
                                    _start();
                                });
                            }
                        } else {
                            message('err', 'api error?: ' + result.status);
                        }
                        self._pquery = self._query;
                    }
                });
            }
            this.isPlaying = true;
        }
    };
    
    GlitchPlayer.prototype.stop = function() {
        console.log('Q', this._query);
        if (this._query == '') {
            message('def');
        } else {
            message('tweet', 'share on twitter with params');    
        }
        $('#tips').hide();
        $('#main').fadeIn('slow');
        if (this._timerId) {
            clearInterval(this._timerId);
        }
        this._timerId = 0;
        this.isPlaying = false;
    };
    
    GlitchPlayer.prototype._view = function() {
        var now = new Date().getTime(),
            reloadInterval = 60 / this.bpm * 4 * 1000;
        
        if (reloadInterval < now - this._prevTime) {
            this._reloadImage();
            this._prevTime = now;
        }
        
        if (this._orig) {
            this._image[this._i++].src = image(glitch(this._orig, this.gain));
            this._i &= 0x0f;
        }
    };
    
    GlitchPlayer.prototype._reloadImage = function() {
        var self = this;
        var url = choice(this.urls);

        if (url in this._imagePool) {
            this._orig = this._imagePool[url];
            this._s = choice(SIZE_TABLE);
            this._x = randint(-(self._s-(WIDTH-90)), 90);
            this._y = randint(-(self._s-(HEIGHT-90)), 90);
        } else if (url) {
            $.ajax({
                type: 'GET',
                url: '/api/image/' + url,
                beforeSend: function(xhr) {
                    xhr.overrideMimeType('text/plain; charset=x-user-defined');
                },
                success: function(data, textStatus, xhr) {
                    self._imagePool[url] = self._orig = data;
                    self._s = choice(SIZE_TABLE);
                    self._x = randint(-(self._s-(WIDTH-90)), 90);
                    self._y = randint(-(self._s-(HEIGHT-90)), 90);
                }
            });
        } else {
            console.warn("url ??", this.urls);
        }
    };
    
    
    var canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    document.body.appendChild(canvas);

    var player = new GlitchPlayer(canvas, 15);
    
    function tweet(param) {
        var h = 550,
            i = 520,
            j = screen.height,
            k = screen.width,
            b,c, lis, url;
        b = Math.round(k/2-h/2);
        c = Math.round(j/2-i/2);
        console.log('param', param);
        lis = [
            "http://twitter.com/share?lang=ja",
            "text=GLISTAGRAM",
            "url=" + escape('http://glistagram.herokuapp.com/') + param,
            "counturl=" + escape('http://glistagram.herokuapp.com/')
        ];
        url = lis.join('&');
        window.open(url, "intent","width="+h+",height="+i+",left="+b+",top="+c);
    }
    
    function message(type, msg) {
        console.log("message", type);
        switch (type) {
          case 'load':
            $('#icon').attr('src', '/public/images/progress.gif');
            $('#message-text').css('color', '#dcdcdc').text(msg);
            break;
          case 'tweet':
            $('#icon').attr('src', '/public/images/twitter.png');
            $('#message-text')
                .text('')
                .append(
                    $(document.createElement('a')).text(msg)
                        .click(function() {
                            tweet(escape(escape($('#query').val()))+'?'+gain.slider("value")+'x'+bpm.slider("value"));
                        })
                        .attr('href', 'javascript:void(0)')
            );
            break;
          case 'warn':
            $('#icon').attr('src', '/public/images/favicon.png');
            $('#message-text').css('color', '#ffff66').text(msg);
            break;
          case 'err':
            $('#icon').attr('src', '/public/images/favicon.png');
            $('#message-text').css('color', '#f33').text(msg);
            break;
        default:
            $('#icon').attr('src', '/public/images/favicon.png');
            $('#message-text').text('input query and push "go"');
            break;
        }
    }
    
    // UI
    var gain = $('#gain').slider({
        min:0, max:10, value:8,
        change: function(event, ui) {
            player.gain = ui.value;
            $('#gain-val').text(ui.value);
        },
        slide: function(event, ui) {
            player.gain = ui.value;
            $('#gain-val').text(ui.value);
        }});
    
    var bpm = $('#bpm').slider({
        min:60, max:240, value:120, step: 1,
        change: function(event, ui) {
            player.bpm = ui.value;
            $('#bpm-val').text(ui.value);
        },
        slide: function(event, ui) {
            player.bpm = ui.value;
            $('#bpm-val').text(ui.value);
        }});
    
    $('#go').mousedown(function() {
        player.start();
    });
    
    $('#tips').mousedown(function() {
        player.stop();
    });
    
    $('#query').change(function() {
        var value, isTag;
        value = this.value.trim();
        player.setq(value);
    });
    
    var noShortcut = false;
    $('#query').focus(function() {
        noShortcut = true;
    }).blur(function() {
        noShortcut = false;
    });
    
    $(window).keypress(function(e) {
        var val;
        if (noShortcut) return;
        switch (e.which) {
          case 32: // space
            if (player.isPlaying) {
                player.stop();
            } else {
                player.start();
            }
            break;
          case 107: // k
            val = gain.slider("value") + 1;
            if (10 < val) val = 10;
            gain.slider("value", val);
            break;
          case 106: // j
            val = gain.slider("value") - 1;
            if (val < 0) val = 0;
            gain.slider("value", val);
            break;
          case 104: // h
            val = bpm.slider("value") - 5;
            if (val < 60) val = 60;
            bpm.slider("value", val);
            break;
          case 108: // l
            val = bpm.slider("value") + 5;
            if (240 < val) val = 240;
            bpm.slider("value", val);
            break;
          case 105: // i
            $('#query').focus();
            e.preventDefault();
            break;
        default:
            // console.log(e.which);
            break;
        }
    });
    
    //
    (function() {
        var q, s, m;
        q = unescape(location.pathname.substring(1));
        if (q.match('^#?[0-9a-zA-Z]+$')) {
            $('#query').val(q).change();
            s = location.search.substring(1);
            m = s.match('^([0-9]{1,2})x([0-9]{2,3})$');
            if ((m = s.match('^([0-9]{1,2})x([0-9]{2,3})$'))) {
                gain.slider("value", m[1]|0);
                bpm.slider("value", m[2]|0);
            }
            player.start();
        }
    }());
};
