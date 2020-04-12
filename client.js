window.AudioContext = window.AudioContext || window.webkitAudioContext;

const socketio = io.connect(location.origin, { resource: 'audio', transports: ['websocket'] });
const audioContext = new AudioContext();
let audioInput = null,
  realAudioInput = null,
  inputPoint = null,
  recording = false;

function toggleRecording(e) {
  if (e.classList.contains('recording')) {
    // stop recording
    e.classList.remove('recording');
    e.textContent = "Start recording";
    recording = false;
    socketio.emit('end-recording');
  } else {
    // start recording
    e.classList.add('recording');
    e.textContent = "Stop recording";
    recording = true;
    socketio.emit('start-recording', { numChannels: 1, bps: 16, fps: parseInt(audioContext.sampleRate) });
  }
}

function convertToMono(input) {
  var splitter = audioContext.createChannelSplitter(2);
  var merger = audioContext.createChannelMerger(2);

  input.connect(splitter);
  splitter.connect(merger, 0, 0);
  splitter.connect(merger, 0, 1);
  return merger;
}

function gotStream(stream) {
  inputPoint = audioContext.createGain();

  // Create an AudioNode from the stream.
  realAudioInput = audioContext.createMediaStreamSource(stream);
  audioInput = realAudioInput;

  audioInput = convertToMono(audioInput);
  audioInput.connect(inputPoint);

  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 2048;
  inputPoint.connect( analyserNode );

  scriptNode = (audioContext.createScriptProcessor || audioContext.createJavaScriptNode).call(audioContext, 1024, 1, 1);
  scriptNode.onaudioprocess = function (audioEvent) {
    if (recording) {
      input = audioEvent.inputBuffer.getChannelData(0);

      const left16 = downsampleBuffer(input, 44100, 16000);

      socketio.emit('write-audio', left16);
    }
  }
  inputPoint.connect(scriptNode);
  scriptNode.connect(audioContext.destination);

  zeroGain = audioContext.createGain();
  zeroGain.gain.value = 0.0;
  inputPoint.connect(zeroGain);
  zeroGain.connect(audioContext.destination);
  // updateAnalysers();
}

function initAudio() {
  if(!navigator.getUserMedia)
    navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  if(!navigator.cancelAnimationFrame)
    navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
  if(!navigator.requestAnimationFrame)
    navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

  navigator.getUserMedia({ audio: true }, gotStream, function(e) {
    alert('Error getting audio');
    console.log(e);
  });
}

function downsampleBuffer(buffer, sampleRate, outSampleRate) {
  if(outSampleRate === sampleRate) {
    return buffer;
  }

  if(outSampleRate > sampleRate) {
    throw new Error('downsampling rate show be smaller than original sample rate');
  }

  const sampleRateRatio = sampleRate / outSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while(offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;

    for(let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }

    result[offsetResult] = Math.min(1, accum / count) * 0x7FFF;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result.buffer;
}

window.addEventListener('load', initAudio);
