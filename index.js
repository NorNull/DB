var express = require ('express');
var app = express ();
var server = require ('http').createServer (app);
var io = require ('socket.io').listen (server);
var mysql = require('mysql');

var pool = mysql.createPool ({
    connectionLimit: 1000,
    host: 'us-cdbr-iron-east-04.cleardb.net',
    //host: '124.121.226.210',
    user: 'b3a577478b4bfa',
    passward: '790f0d96',
    database: 'heroku_8c4f4f56275aa33',
    debug: false
})

var user = {};
var ai_server;

app.set ('port', process.env.PORT || 3000);

app.get ('/', getRoot);

function getRoot (req, res) {
  res.send ('Hello World');
}

server.listen (app.get ('port'), function () {
  console.log ("Server is running")
});

io.on('connection', function (socket) {

    socket.on('Create_User', function (raw_data) {
        user[raw_data['user_name']] = socket.id;

        pool.getConnection(function(err,connection){
            if (err) return;

            var user = {user_name : raw_data ['user_name'], user_passward : raw_data ['passward']};

            var already_taken = false;

            connection.query('SELECT * FROM user WHERE user_name = ?', raw_data['user_name'], function (err, rows, fields) {

                if (rows.length > 0) {
                    var data = { 'command': 'Create User', 'message': 'Create Failed' };

                    socket.emit('Receive_Setting_User', data);

                    already_taken = true;
                    return;
                }
            });

            if (!already_taken) {
                connection.query('INSERT INTO user SET ?', user, function (err, res) {
                    if (err) return;
                    var data = { 'command': 'Create User', 'message': 'Create Success' };

                    socket.emit('Receive_Setting_User', data);

                    data = { 'command': 'New_Player', 'user_name': raw_data ['user_name'] };

                    io.sockets.connected[ai_server].emit('Receive_Setting_User', data);
                });
            }
        });
    });

    socket.on('Create_AI_Server', function (raw_data) {
        ai_server = socket.id;
    });

    socket.on('Login', function (raw_data) {
        user[raw_data['user_name']] = socket.id;

        pool.getConnection(function(err,connection){
            if (err) return;

            var user = { user_name: raw_data['user_name'], user_passward: raw_data['passward'] };

            var already_taken = false;

            connection.query('SELECT * FROM user WHERE user_name = ?', raw_data['user_name'], function (err, rows, fields) {
                if (rows[0].user_room_name != 0)
                {
                    connection.query('SELECT * FROM chat WHERE room_name = ?', rows[0].user_room_name, function (err, r_rows, fields) {
                        socket.emit('Room_Chat_Setting', r_rows);

                    });
                }

                var data = { 'command': 'Login', 'message': 'Login Success' };

                socket.emit('Receive_Setting_User', data);

                already_taken = true;
            });

            if (!already_taken) {
                var data = { 'command': 'Login', 'message': 'Login Failed' };

                socket.emit('Receive_Setting_User', data);
            }
        });
    });

    socket.on('Logout', function (raw_data) {
        var data = {'user': raw_data['user_name'] };

        socket.broadcast.emit('Receive_Logout', data);
    });

    socket.on('Chat', function (raw_data) {
        if (raw_data['type'] == 'Room') {
            var data = {'user': raw_data['user_name'], 'message': raw_data['data'] };

            socket.broadcast.to(raw_data['room']).emit('Receive_Chat', data);
        }

        else if (raw_data['type'] == 'Friend') {
            var data = { 'user': raw_data['user_name'], 'message': raw_data['data'] };

            io.sockets.connected[user[raw_data['to_user']]].emit('Receive_Chat', data);
        }

        else
        {
            var data = {'user': raw_data['user_name'], 'message': raw_data['data'] };

            socket.broadcast.emit('Receive_Chat', data);
        }

        console.log(raw_data['type'] + ' : ' + raw_data['data'])
    });

    socket.on('Create_Room_Chat', function (raw_data) {
        pool.getConnection(function (err, connection) {
            if (err) return;

            var room = { room_name: raw_data['room_name'], leader_name: raw_data['user_name'] };

            var already_taken = false;
            connection.query('SELECT * FROM chat WHERE room_name = ?', raw_data['room_name'], function (err, rows, fields) {
                var data = { 'message': 'Create Failed' };

                socket.emit('Room_Chat_Setting', data);

                already_taken = true;
            });

            if (!already_taken) {
                connection.query('INSERT INTO chat SET ?', room, function (err, res) {
                    if (err) return;

                    var data = { 'message': 'Create Success' };

                    socket.emit('Room_Chat_Setting', data);
                });
            }
        });
    });

    socket.on('Join_Room_Chat', function (raw_data) {
        pool.getConnection(function (err, connection) {
            if (err) return;

            connection.query('SELECT * FROM chat WHERE room_name = ?', raw_data['room_name'], function (err, rows, fields) {
                connection.query('UPDATE chat SET members WHERE room_name = ?', [rows [0].members + " " + raw_data ['user_name'], raw_data['room_name']], function (err, result) {

                });

                connection.query('UPDATE user SET user_room_name WHERE user_name = ?', [raw_data['room_name'], raw_data['user_name']], function (err, result) {

                });
            });
        });
    });

    socket.on('Remove_Room_Chat', function (raw_data) {
        //
    });

    socket.on('Kick_Room_Chat', function (raw_data) {
        //
    });

    socket.on('Connection', function (raw_data) {
        socket.broadcast.emit('Receive_Setting_User', raw_data);
    });

    socket.on('Create_Player', function (raw_data) {
        if (raw_data['ser_log'] == 'Create') {
            pool.getConnection(function (err, connection) {
                if (err) return;

                connection.query('UPDATE user SET user_data = ? WHERE user_name = ?', [raw_data['user_data'], raw_data['user_name']], function (err, result) {

                });
            });
        }

       io.sockets.connected[user[raw_data['user_name']]].emit('Receive_Setting_User', raw_data);
    });

    socket.on('Create_Stats', function (raw_data) {

        if (socket.id == ai_server) {
            io.sockets.connected[user[raw_data['user_name']]].emit('Receive_Setting_User', raw_data);
        }

        else {
            io.sockets.connected[ai_server].emit('Receive_Setting_User', raw_data);
        }

    });
});
