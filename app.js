// app.js -- a nodejs WebSocket Server Application
//
// (The MIT License)
//
// Copyright (c) 2012 Silicon Valley Lines Model Railroad Club
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
// of the Software, and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

"use strict";

var path = require('path'),
	connect = require('connect'),
	clients = [];
    
var WebSocket = require('ws');
var ws = null;
var jmriSocketReady = false;

var startupDate = new Date();
var startupTime = startupDate.getTime();

var helloMessage = null;

setInterval(function() {
    if(!jmriSocketReady)
    {
        ws = new WebSocket('ws://127.0.0.1:12080/json/');

        ws.on('open', function() {
            jmriSocketReady = true;
            console.log("Connection to JMRI established");
            io.emit('nodeJMRISocketStatus', jmriSocketReady);
        });

        ws.on('close', function() {
            jmriSocketReady = false;
            console.log("Connection to JMRI closed");
            io.emit('nodeJMRISocketStatus', jmriSocketReady);
            helloMessage = null;
        });

        ws.on('message', function(data,flags) {
            var msgObj = JSON.parse(data);
            var logData = true;
            
            if(msgObj.length == undefined)
            {
                if(msgObj.type == "pong")
                    logData = false;
              
                if(msgObj.type == "hello")
                    helloMessage = data;
            }
            
            io.emit('update', data);
            
            if(logData == true)
            {
                var broadcastDate = new Date();
                var broadcastTime = (broadcastDate.getTime() - startupTime)/1000;
      
                console.log("All clients @ " + broadcastTime + "; Data rebroadcast from JMRI: " + data);
            }
        });
        
        ws.on('error', function(e) {
            console.log("Error: " + e.code);
            io.emit('nodeJMRISocketStatus', jmriSocketReady);
        });
    }
    else
    {
        // Set up ping to maintain connection
        ws.send('{"type":"ping"}');
    }
}, 10000);

// Create an HTTP Server Using the connect framework. This server is
// responsible for vending static content such as the HTML, JS, CSS,
// and SVG which runs the user interface on client devices.

var oneDay = 86400000;
var server = connect()
//	.use(connect.logger('dev'))
//	.use(connect.static(__dirname + '/static'),{maxAge: oneDay})
	.use(connect.static(__dirname + '/static'))
	.use(connect.directory(__dirname + '/static',{filter: customFileFilter}))
	.listen(3000);


// Create a socket.io server associated with the HTTP server.
// state and/or request changes. We need to track the connected clients
// in order to deliver any out-of-band updates reported by JMRI.

var io = require('socket.io')(server);

	io.on('connect', function (socket) {
        var connectDate = new Date();
        var connectTime = (connectDate.getTime() - startupTime)/1000;

		clients[socket.id] = socket;	// track the socket in clients array
        console.log("Client " + socket.id + " @ " + connectTime + "; Connected");

		socket.on('disconnect', function () {
            var disconnectDate = new Date();
            var disconnectTime = (disconnectDate.getTime() - startupTime)/1000;
      
            console.log("Client " + socket.id + " @ " + disconnectTime + "; Disconnected");
			delete clients[socket.id];	// stop tracking the client
		});
        
		// process the command and broadcast updates to all other clients
		socket.on('set', function (data) {
			if(jmriSocketReady)
            {
                var setDate = new Date();
                var setTime = (setDate.getTime() - startupTime)/1000;

                console.log("Client " + socket.id + " @ " + setTime + "; Set sent to JMRI: " + data);
                ws.send(data);
            }
		});

		// reply to sender with response to query of existing state
		socket.on('get', function (data) {
            if(jmriSocketReady)
            {
                var getDate = new Date();
                var getTime = (getDate.getTime() - startupTime)/1000;

                console.log("Client " + socket.id + " @ " + getTime + "; Get sent to JMRI: " + data);
                ws.send(data);
            }
		});
        
        if(helloMessage != null)
            socket.emit('update', helloMessage);
	});

// Filter function for the connect.directory middleware. This function allows
// us to get by without an index.html and will allow folks to navigate to panel
// files directly. By default, we only allow the user to see SVG and HTML files.
// This has the side effect of hiding subdirectories from the casual browser.

function customFileFilter(file) {
        switch (path.extname(file)) {
        case '.html':
        case '.svg':
                return true;
                
        default:
                break;
        }
        return false;
}
