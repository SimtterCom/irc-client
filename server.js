/*
    IRC Relay Server
    Copyright (C) 2014  http://blog.simtter.com

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
/*
// 最も単純なsocket.ioサーバー
var http = require('http');
var socketio = require('socket.io');
var server = http.createServer();
var io = socketio.listen(server);
server.listen(process.env.PORT);
*/

var http = require('http');
var path = require('path');

var async = require('async');
var socketio = require('socket.io');
var express = require('express');

var irc = require("./irc");

var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

router.use(express.static(path.resolve(__dirname, 'client')));

var ircClients = {};

// サーバ処理
// サーバへの接続があったときのイベントリスナ
io.sockets.on('connection', function (socket) {

	// 接続する
	socket.on("LOGIN", function (data) {
        var ircClient = ircClients[socket.id];
        if(ircClient) { //すでに接続済み
            return;
        }
        data.encoding = "utf8";
        data.debug = true;
        data.eventJOIN = function( client, msg){
            socket.emit("JOIN", msg);
        };

        data.eventMODE = function( client, msg){
            socket.emit("MODE", msg);
        };
        
        data.event433 = function( client, msg){
            socket.emit("433", msg);
            ircClient.disconnect("433");
            delete ircClients[socket.id];
        };
        
        data.event353 = function( client, msg){
            socket.emit("353", msg);
        };

        data.event366 = function( client, msg){
            socket.emit("366", msg);
        };

        data.eventPRIVMSG = function( client, msg){
            socket.emit("PRIVMSG", msg);
        };
        
        data.eventPART = function( client, msg){
            socket.emit("PART", msg);
        };

        data.eventQUIT = function( client, msg){
            socket.emit("QUIT", msg);
        };

        ircClient = ircClients[socket.id] = new irc.Client(data);
        ircClient.connect();
	});
	
	// 入室する
	socket.on("JOIN", function (data) {
        var ircClient = ircClients[socket.id];
        if(!ircClient) { //接続されていない
            return;
        }
        
        ircClient.join(data.channelNames);
	});

	// メッセージ送信
	socket.on("PRIVMSG", function (data) {
        var ircClient = ircClients[socket.id];
        if(!ircClient) { //接続されていない
            return;
        }
        
        var channelName = ircClient.channelNames[0];
        if(channelName==="") {
            return;
        }

        var channel = ircClient.channels[channelName];
        if(channel===null) {
            return;
        }

        channel.post(data.msg);
	});

	// 退室する
	socket.on("PART", function (data) {
        var ircClient = ircClients[socket.id];
        if(!ircClient) { //接続されていない
            return;
        }
        
        ircClient.part();
	});

	// 切断する
	socket.on("QUIT", function (data) {
        var ircClient = ircClients[socket.id];
        if(!ircClient) { //接続されていない
            return;
        }
        
        ircClient.quit();
	});

	socket.on("delete", function () {
        var ircClient = ircClients[socket.id];
        if(!ircClient) { //接続されていない
            return;
        }
        ircClient.disconnect("delete");
        delete ircClients[socket.id];
	});

	// 切断したときに送信
	socket.on("disconnect", function () {
        var ircClient = ircClients[socket.id];
        if(!ircClient) { //接続されていない
            return;
        }
        ircClient.disconnect("disconnect");
        delete ircClients[socket.id];
	});
});

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});
