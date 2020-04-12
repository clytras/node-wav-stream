const { v4: uuidv4 } = require('uuid');
const WavFileWriter = require('wav').FileWriter;
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  resource: 'audio'
})

const ServerPort = 13000;

let outputFileStream;

app.use(express.static(__dirname));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(client){
  console.log('a user connected');

  let id;

  client.on('start-recording', function() {
    // stream = fs.createWriteStream('tesfile.wav');

    id = uuidv4();

    console.log(`start-recording:${id}`);
  
    outputFileStream = new WavFileWriter(`./audio/recs/${id}.wav`, {
      sampleRate: 16000,
      bitDepth: 16,
      channels: 1
    });
  });

  client.on('end-recording', function() {
    console.log(`end-recording:${id}`);

    if(outputFileStream) {
      outputFileStream.end();
    }
    outputFileStream = null;
  });

  client.on('write-audio', function(data) {
    console.log(`write-audio:${id}, got ${data ? data.length : 0} bytes}`);

    if(outputFileStream) {
      outputFileStream.write(data);
    }
  });
});

http.listen(ServerPort, function(){
  console.log(`listening on *:${ServerPort}`);
});
