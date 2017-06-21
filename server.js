var net = require('net');
var sha1 = require('sha1');
var express = require('express');
var app = express();
var io = require('socket.io')();

app.use("/", express.static('.'));
app.use("/static", express.static('./node_modules/socket.io-client/dist'));
app.use("/static", express.static('./node_modules/d3/build'));
var server = app.listen(80);
const MAX_POWER = 16777215;
function round2dec(fNum){
	var rounded = Math.round(fNum*100) / 100;
	// console.log('Origin:' + fNum + ', Rounded:' + rounded);
	return rounded;
}
function normalizeWavePower(wavePower){
	return round2dec(wavePower/MAX_POWER*100);
}
function processEegPower(eegPower){
	var waveTypes = Object.keys(eegPower);
	var processedEeg = {};
	for(var wave in waveTypes) {
		var waveName = waveTypes[wave];
		// processedEeg[waveName] = normalizeWavePower(eegPower[waveName]);
		processedEeg[waveName] = round2dec(Math.log(eegPower[waveName]));
	}
	return processedEeg;
}
//*Implement socket.io streaming.
io.attach(server);
io.on('connection', function(socket) {
	var client = net.connect({
		port:13854,
		host:'127.0.0.1'
	}, function(){
		var configObj = {
			"enableRawOutput": false,
			"format":"Json"
		}
		client.write(JSON.stringify(configObj));
	})
	client.on('data', function(data){
		data = data.toString().split("\r");
		for (var i = 0; i < data.length; i++) {
			if (data[i] == '')
				continue;
			var dataObj = JSON.parse(data[i]);
			// console.log(dataObj);
			if (dataObj['eSense'] != undefined) {
				// Emit EEG signal data.
				var sendbackEeg = {};
				sendbackEeg['signal'] = dataObj.poorSignalLevel;
				sendbackEeg['attMed'] = dataObj.eSense;
				sendbackEeg['waves'] = processEegPower(dataObj.eegPower);
				socket.emit('eeg', sendbackEeg);
				console.log(sendbackEeg);
			}
		}
	})
	client.on('end', function(){
		console.log('Connection with Mindwave Connector has ended.');
	})
	client.on('error', function(err){
		console.log('Trouble with Neurosky Connector.');
	})
	console.log("Connected: %s", socket.id);
	socket.on('my other event', function(data) {
		console.log("Data from the client:" + JSON.stringify(data));
	})
	socket.on('disconnect', function(data){
		console.log('Client has disconnected');
		client.destroy();
	});
})
