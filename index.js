
const express = require('express');
const { exec } = require('child_process');
const bodyParser = require('body-parser'); 


const app = express();
const port = 3000;

app.use(bodyParser.json());


app.get('/microphones', (req, res) => {
  exec('pacmd list-sources', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing pacmd list-sources: ${error}`);
      return res.status(500).send('Internal Server Error');
    }

    // Parse the output to extract information about microphones
    const microphones = parseMicrophones(stdout);

    res.json({ microphones });
  });
});

function parseMicrophones(output) {
  const lines = output.split('\n');
  const microphoneList = [];
  let currentMicrophone = {};

  lines.forEach(line => {
    if (line.startsWith('  * index:')) {
      // Start of a new microphone entry
      if (Object.keys(currentMicrophone).length !== 0) {
        microphoneList.push(currentMicrophone);
      }
      currentMicrophone = { index: parseInt(line.split(':')[1].trim(), 10) };
    } else if (line.startsWith('	name:')) {
      currentMicrophone.name = line.split(':')[1].trim();
    } else if (line.startsWith('	driver:')) {
      currentMicrophone.driver = line.split(':')[1].trim();
    } else if (line.startsWith('	flags:')) {
      currentMicrophone.flags = line.split(':')[1].trim();
    }
  });

  // Add the last microphone to the list
  if (Object.keys(currentMicrophone).length !== 0) {
    microphoneList.push(currentMicrophone);
  }

  return microphoneList;
}


app.post('/push-audio', (req, res) => {
    console.log('Request Body:', req.body);
  
    const { microphoneIndex, audioFiles } = req.body;
  
    if (microphoneIndex === undefined || audioFiles === undefined) {
      return res.status(400).send('Bad Request: Missing required parameters.');
    }
  
    // Validate microphoneIndex
    if (isNaN(microphoneIndex)) {
      return res.status(400).send('Bad Request: Invalid microphoneIndex.');
    }
  
    // Convert single audio file to an array for consistency
    const audioFilesArray = Array.isArray(audioFiles) ? audioFiles : [audioFiles];
  
    const gstCommand = audioFilesArray.length === 1
      ? `gst-launch-1.0 -v filesrc location=${audioFilesArray[0]} ! decodebin ! audioconvert ! audioresample ! audio/x-raw,channels=1 ! pulsesink device=alsa_output.pci-0000_00_1f.3.analog-stereo.monitor`
      : `gst-launch-1.0 -v interleave name=i ! audioconvert ! audioresample ! voaacenc ! aacparse ! mpegtsmux ! rtspclientsink location=rtsp://127.0.0.1:8554/test ${audioFilesArray.map(file => `filesrc location=${file} ! decodebin ! audioconvert ! "audio/x-raw,channels=1,channel-mask=(bitmask)0x${audioFilesArray.indexOf(file) + 1}" ! queue ! i.sink_${audioFilesArray.indexOf(file)}`).join(' ')}`;
  
    exec(gstCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing GStreamer command: ${error}`);
        return res.status(500).send('Internal Server Error');
      }
  
      res.send('Audio pushed successfully.');
    });
  });
  

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});


