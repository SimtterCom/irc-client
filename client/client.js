function ChatController($scope) {
    var socket = io.connect();

    initialzeScope();

    socket.on('connect', function () {
    });

    socket.on('disconnect', function (client) {
      initialzeScope();
      $scope.$apply();
    });

    $scope.login = function login() {
        if($scope.client.logined) { //ログイン済みならログアウトする
            socket.emit("QUIT"); //サーバへ送信
        } else {    //未ログインならログインする
            $('#loginWaitModal').modal('show');
            socket.emit("LOGIN", $scope.client); //サーバへ送信
        }
    };

    socket.on("MODE", function (data) {
        if($scope.client.logined) {
            return;
        }
        var prefix = data.prefix.split(",");
        var nickName = prefix[0];
        if(nickName==$scope.client.nickName) {
          $scope.client.logined = true;
          $scope.$apply();
          $('#loginWaitModal').modal('hide');
          $('#loginSuccessModal').modal('show');
        }
    });

    socket.on("433", function (data) {
        if($scope.client.logined) {
            return;
        }
        var nickName = data.args[1];
        if(nickName==$scope.client.nickName) {
          $scope.client.logined = false;
          $scope.$apply();
          $('#loginWaitModal').modal('hide');
          $('#loginFailedModal').modal('show');
        }
    });

    socket.on("QUIT", function (data) {
        if(!$scope.client.logined) {
            return;
        }
        var prefix = data.prefix.split("!");
        var nickName = prefix[0];
        var index = getIndexInChannelUsers(nickName);
        if(index >= 0) {
            $scope.channelUsers.splice(index, 1);
            addMessage(nickName, " quit " + " ( " + data.args[0] + " )");
        }
        if(nickName==$scope.client.nickName) {
            socket.emit("delete");
            initialzeScope();
            $scope.$apply();
        }
    });

    $scope.join = function join() {
        if(!$scope.client.logined) {
            return;
        }
        
        var data = {nickName:$scope.client.nickName, channelNames:[$scope.client.channelName]};
        if($scope.client.joined) {  //入室済みなら退室する
            socket.emit("PART", data); //サーバへ送信
            $scope.client.joined = false;
        } else {    //退室済みなら入室する
            socket.emit("JOIN", data); //サーバへ送信
            $scope.client.joined = true;
        }
    };
    
    socket.on("JOIN", function (data) {
        if(!$scope.client.joined) {
            return;
        }
        
        var channelName = data.args[0];
        if(channelName==$scope.client.channelName) {
          var prefix = data.prefix.split("!");
          var nickName = prefix[0];
          var index = getIndexInChannelUsers(nickName);
          if(index < 0) {
            $scope.channelUsers.push(nickName);
            addMessage(nickName, " join " + channelName + " ( " + prefix[1] + " )");
          }
        }
    });

    socket.on("353", function (data) {
        if(!$scope.client.joined) {
            return;
        }
        
        var channelName = data.args[2];
        if(channelName==$scope.client.channelName) {
            if(!$scope.startedChannelUsers) {
                $scope.channelUsers = [];
                $scope.startedChannelUsers = true;
            }
            var channelUsers = data.args[3].split(" ");
            for(var i = 0; i < channelUsers.length; i++) {
                $scope.channelUsers.push(channelUsers[i]);
            }
        }
    });
    
    socket.on("366", function (data) {
        if(!$scope.client.joined) {
            return;
        }
        
        var channelName = data.args[1];
        if(channelName==$scope.client.channelName) {
            if(!$scope.startedChannelUsers) {
                return;
            }

            $scope.$apply();
            $scope.startedChannelUsers = false;
        }
    });

    socket.on("PART", function (data) {
        if(!$scope.client.joined) {
            return;
        }
        
        var channelName = data.args[0];
        if(channelName==$scope.client.channelName) {
          var prefix = data.prefix.split("!");
          var nickName = prefix[0];
          var index = getIndexInChannelUsers(nickName);
          if(index >= 0) {
            $scope.channelUsers.splice(index, 1);
            addMessage(nickName, " part " + " ( " + data.args[1] + " )");
          }
        }
    });

    $scope.privmsg = function privmsg() {
        if(!$scope.client.joined) {
            return;
        }
        console.log('privmsg:', $scope.text);
        var data = {nickName:$scope.client.nickName, msg:$scope.message};
        socket.emit('PRIVMSG', data);
        addMessage(data.nickName, data.msg);
        $scope.message = '';
    };

    socket.on("PRIVMSG", function (data) {
        if(!$scope.client.joined) {
            return;
        }
        var prefix = data.prefix.split("!");
        var nickName = prefix[0];
        var msg = toSafetyString(data.args[1]);
        addMessage(nickName, msg);
    });

    $scope.getLoginLabel = function getLoginLabel() {
        return $scope.client.logined ? "Logout" : "Login";
    };
    
    $scope.getJoinLabel = function getJoinLabel() {
        return $scope.client.logined ? ( $scope.client.joined ? "Part" : "Join") : "Join";
    };
    
    function initialzeScope(value) {
      $scope.messages = [];
      $scope.channelUsers = [];
      $scope.client = {
          host: "irc.freenode.net",
          port: 6667,
          nickName: "simttercom",
          userName: "SimtterCom",
          realName: "simtter.com",
          channelName: "#wordpress-ja",
          logined: false,
          joined: false
      };
      $scope.startedChannelUsers = false;
    }

    function toSafetyString(value) {
        var ret = value.replace( /[!@$%<>'"&|]/g, '' ); //タグ記号とかいくつか削除
        return ret;
    }
    
    //メッセージを追加
    function addMessage(nickName, message) {
        $scope.messages.push({nickName:nickName, message:message});
        $scope.$apply();
    }

    function getIndexInChannelUsers(nickName) {
        var index = $scope.channelUsers.indexOf(nickName);
        if(index < 0) {
          index = $scope.channelUsers.indexOf("@" + nickName);  //@が付いている可能性アリ
        }
        return index;
    }

}
