var sys = require("sys");
var net = require("net");

var Channel = exports.Channel = function( client, name){
  
    this.client = client;
    this.name   = name;
    this.joined = false;
};

Channel.prototype.join = function(){
    
    this.client.send( "JOIN " + this.name);
};

Channel.prototype.part = function(){
    
    this.client.send( "PART " + this.name);
};

Channel.prototype.post = function( msg){
    
    this.client.send( "PRIVMSG " + this.name + " : " + msg);
};

Channel.prototype.notice = function( msg){
        
    this.client.send( "NOTICE " + this.name + " : " + msg);
};

var Client = exports.Client =  function( conf){
    this.initialize( conf);
};

Client.prototype.initialize = function( conf){
    
    this.host     = conf.host;
    this.port     = conf.port;
    this.nickName = conf.nickName;
    this.userName = conf.userName;
    this.realName = conf.realName;
    this.encoding = conf.encoding;
    this.joined = false;
    this.channelNames = conf.channelNames || [];
    this.channels = {};
    this.timeout = 60*60*72;
    this.debug = conf.debug || false;
    this.connection = null;

    this.event = {};
    //load events
    for( var key in conf){
        if( key.indexOf("event") === 0 && typeof( conf[key]) == "function"){
            this.event[key.substr(5)] = conf[key];
        }
    }
};

Client.prototype.connect = function(){
    
    var socket = this.socket = net.createConnection( this.port, this.host);
    socket.setEncoding( this.encoding);
    socket.setTimeout( this.timeout);

    this.addEventListener( "connect", function(){
        if(this.debug){
            sys.puts("connected!");
        }
        
        this.send( "NICK " + this.nickName);
        this.send( "USER " + this.userName + " 0 * : " + this.realName);
        
    });
    
    this.addEventListener( "data", function( chunk){
        if(this.debug){
            sys.puts("-----chunk-----");
            sys.puts(chunk);
        }
        for( var i = 0, lines = chunk.split("\r\n"), len = lines.length; i < len; i++){
            var msg = Client.parse(lines[i]);
            if(this.debug){
                sys.puts("-----msg-----");
                sys.puts( msg);
            }
            this.executeMessage( msg);
        }
        if(this.debug){
            sys.puts("-----end-----");
        }
    });

    this.addEventListener( "close", function(){
        this.disconnect( "close");
    });
    this.addEventListener( "eof", function(){
        this.disconnect( "EOF");
    });
    this.addEventListener( "timeout", function(){
        this.disconnect( "timeout");
    });
};

Client.prototype.disconnect = function( msg){
    if(!this.socket) {
        return;
    }
    if( this.socket.readyState !== "closed"){
        this.socket.end();
        this.socket = null;
        sys.puts("disconnected (" + msg +")");
    }
};

Client.prototype.join = function(channels){
    if(!this.socket) {
        return;
    }
    if( !this.joined && channels && (channels.length > 0)){
        this.channelNames = channels;
        for( var j = 0, len = this.channelNames.length; j < len; j++){
            var name = this.channelNames[j];
            var channel = new Channel(this, name);
            channel.join();
            this.channels[name] = channel;
        }
        this.joined = true;
    } 
};

Client.prototype.part = function(){
    if(!this.socket) {
        return;
    }
    if(this.joined) {
        for( var j = 0, len = this.channelNames.length; j < len; j++){
            var name = this.channelNames[j];
            var channel = this.channels[name];
            if(channel) {
                channel.part();
                delete this.channels[name];
            }
        }
        this.joined = false;
    } 
};

Client.prototype.quit = function(){
    
    this.send( "QUIT " + this.nickName);
};


Client.prototype.executeMessage = function( msg){
  
    var event = this.event[msg.command];
    if( event !== null && event !== undefined && typeof( event) == "function"){
        event(this, msg);
    }
    
    switch( msg.command){
    case "PING":
        this.send( "PONG :" +  msg.args[0]);
        break;
    case "PRIVMSG":
        break;
    }
};

Client.prototype.send = function( msg){
    if(!this.socket) {
        return;
    }
    if( this.socket.readyState !== "open") {
        this.disconnect( "not open");
    }

    if( this.debug) {
        sys.puts(">" + msg);
    }

    this.socket.write( msg+"\r\n", this.encoding);
};

Client.prototype.addEventListener = function( evt, func){
    if(!this.socket) {
        return;
    }
    var self = this;
    return this.socket.addListener( evt, (function(){
        return function(){
            func.apply( self, arguments);
        };
    })());
};

Client.parse = function(chunk){
    
    var tmp = chunk.split( " "), prefix=null, command=null, args=[];
    for( var i = 0, len = tmp.length; i < len; i++){
        if( tmp[i] === ""){
            continue;
        } else if( prefix === null && i === 0 && tmp[i].indexOf( ":") === 0){
            prefix = tmp[i].substr( 1);
        } else if( command === null && tmp[i].indexOf( ":") !== 0){
            command = tmp[i].toUpperCase();
        } else if( tmp[i].indexOf( ":") === 0){
            args.push( tmp.slice(i).join( " ").substr(1));
            break;
        } else {
            args.push(tmp[i]);
        }
    }
    return {
        prefix : prefix,
        command : command,
        args : args,
        toString : function(){
            return "**prefix\t: " + this.prefix + "\n**command\t: " + this.command + "\n**args\t\t: " + this.args;
        }
    };
};

