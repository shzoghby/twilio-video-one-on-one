// Keeps track of video elements and their event listeners
const videoElements = {};

function copyMeetingLink() {
  /* Get the text field */
  var copyText = document.getElementById("room-uuid");

  /* Select the text field */
  copyText.select();
  //copyText.setSelectionRange(0, 99999); /* For mobile devices */

  /* Copy the text inside the text field */
  navigator.clipboard.writeText(`${window.location.origin}/conference.html?roomUUID=${copyText.value}`);

  /* Alert the copied text */
  //alert("Copied the text: " + copyText.value);
}

// Listen to onPlay and onPause events and intelligently re-attach the video element
function shimVideoElement(track, el) {
  let wasInterrupted = false;

  const onPause = () => {
    wasInterrupted = true;
  };

  const onPlay = () => {
    if (wasInterrupted) {
      track.detach(el);
      track.attach(el);
      wasInterrupted = false;
    }
  };

  el.addEventListener('pause', onPause);
  el.addEventListener('play', onPlay);

  // Track this element so we can remove the listeners
  videoElements[el] = { onPause, onPlay };
}

const getPasscode = () => {
  const passcodeInput = document.getElementById('passcode') || {};
  const passcode = passcodeInput.value;
  passcodeInput.value = '';

  return passcode;
};

const getParamValue = (paramName) => {
  const urlSearchParams = new URLSearchParams(window.location.search);
  const params = Object.fromEntries(urlSearchParams.entries());
  const roomName = params[paramName];
  return roomName;
};

const trackSubscribed = (div, track) => {
  div.appendChild(track.attach());

  track.attach(div);
  shimVideoElement(track, div);
};

const trackUnsubscribed = (div, track) => {
  const { onPause, onPlay } = videoElements[div];
  div.removeEventListener('pause', onPause);
  div.removeEventListener('play', onPlay);
  track.detach(div);
  /*
  track.detach().forEach((element) => {
    element.remove();
  });
  */
};

// connect participant
const participantConnected = (participant) => {
  console.log(`Participant '${participant.identity}' connected`);

  const statusDiv = document.getElementById('status');
  const newStatus = document.createElement('div'); // create div for new participant
  newStatus.id = participant.sid + 'status';
  newStatus.innerHTML = `Participant '${participant.identity}' connected`;
  statusDiv.appendChild(newStatus);

  const participantsDiv = document.getElementById('participants');
  const div = document.createElement('div'); // create div for new participant
  div.id = participant.sid;

  participant.on('trackSubscribed', (track) => {
    trackSubscribed(div, track);
  });

  participant.on('trackUnsubscribed', (track) => trackUnsubscribed(div, track));

  participant.tracks.forEach((publication) => {
    if (publication.isSubscribed) {
      trackSubscribed(div, publication.track);
    }
  });
  participantsDiv.appendChild(div);
};
const participantDisconnected = (participant) => {
  console.log(`Participant '${participant.identity}' disconnected.`);
  const statusDiv = document.getElementById('status');
  const newStatus = document.createElement('div'); // create div for new participant
  newStatus.id = participant.sid + 'status';
  newStatus.innerHTML = `Participant '${participant.identity}' disconnected.`;
  statusDiv.appendChild(newStatus);

  document.getElementById(participant.sid).remove();
};

(() => {
  const { Video } = Twilio;
  let videoRoom;
  let localStream;
  const video = document.getElementById('video');

  // preview screen
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((vid) => {
      video.srcObject = vid;
      localStream = vid;
    });

  const joinRoomButton = document.getElementById('button-join');
  const leaveRoomButton = document.getElementById('button-leave');
  const roomControlsForm = document.getElementById('room-controls-form');
  const preConnectControls = document.getElementById('pre-connect-controls');
  const postConnectControls = document.getElementById('post-connect-controls');
  const participantsContainerDiv = document.getElementById('participantsContainer');
  const participantsDiv = document.getElementById('participants');
  const permissionsHelp = document.getElementById('permissions-help');
  const roomNameDiv = document.getElementById('room-name');
  const roomUUIDDiv = document.getElementById('room-uuid');
  const copyLink = document.getElementById('copy-link');
  const participentActionTextDiv = document.getElementById('participentActionText');
  const hostOnlyActionTextDiv = document.getElementById('hostOnlyActionText');
  const hostOnlyGoToHomePageDiv = document.getElementById('hostOnlyGoToHomePage');

  var roomNameUUID = '';
  const userName = document.getElementById('username');
    const usernameLabel = document.getElementById('usernameLabel');

  if (getParamValue('hostName')) {
    roomNameUUID = `${getParamValue('hostName').replaceAll(' ', '.')}.${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    userName.value = getParamValue('hostName');
    userName.style.display = 'none';
    usernameLabel.style.display = 'none';
    participentActionTextDiv.style.display = 'none';
    hostOnlyActionTextDiv.style.display = 'block';
    hostOnlyGoToHomePageDiv.style.display = 'block';
  }
  else {
    roomNameUUID = getParamValue('roomUUID');
    userName.style.display = 'block';
    usernameLabel.style.display = 'block';
    participentActionTextDiv.style.display = 'block';
    hostOnlyActionTextDiv.style.display = 'none';
    hostOnlyGoToHomePageDiv.style.display = 'none';
  }
  roomUUIDDiv.value = roomNameUUID;
  roomNameDiv.innerHTML = `Welcome to '${roomNameUUID}'`;

  const joinRoom = (event) => {
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = "";
    event.preventDefault();

    // get access token
    const userName = document.getElementById('username').value;
    fetch(`video-token?passcode=${getPasscode()}&userName=${userName}&roomName=${roomUUIDDiv.value}`)
      .then((resp) => {
        if (resp.ok) {
          return resp.json();
        }
        console.error(resp);
        if (resp.status === 401) {
          throw new Error('Invalid passcode');
        } else {
          throw new Error('Unexpected error. Open dev tools for logs');
        }
      })
      .then((body) => {
        const { token } = body;
        //console.log(token);
        // connect to room
        return Video.connect(token, { name: roomUUIDDiv.value });
      })
      .then((room) => {
        console.log(`Connected to '${room.name}:${room.sid}' room`);
        const statusDiv = document.getElementById('status');
        const newStatus = document.createElement('div'); // create div for new participant
        newStatus.innerHTML = `Connected to room '${room.name}''`;
        statusDiv.appendChild(newStatus);

        videoRoom = room;
        room.participants.forEach(participantConnected);
        room.on('participantConnected', participantConnected);

        room.on('participantDisconnected', participantDisconnected);
        room.once('disconnected', (error) =>
          room.participants.forEach(participantDisconnected)
        );
        preConnectControls.style.display = 'none';
        permissionsHelp.style.display = 'none';
        postConnectControls.style.display = 'inline-block';
        participantsDiv.style.display = 'flex';

        if(getParamValue('hostName')) {
          copyLink.style.display = 'block';
        }
        else {
          copyLink.style.display = 'none';
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-alert
        alert(err.message);
      });
  };

  //roomControlsForm.onsubmit = joinRoom;
  joinRoomButton.onclick = joinRoom;

  // leave room
  leaveRoomButton.onclick = (event) => {
    videoRoom.disconnect();
    console.log(`Disconnected from Room ${videoRoom.name}`);
    const statusDiv = document.getElementById('status');
    const newStatus = document.createElement('div'); // create div for new participant
    newStatus.innerHTML = `Disconnected from Room ${videoRoom.name}`;
    statusDiv.appendChild(newStatus);

    preConnectControls.style.display = 'inline-block';
    permissionsHelp.style.display = 'inline-flex';
    postConnectControls.style.display = 'none';
    participantsDiv.style.display = 'none';

    if(!getParamValue('hostName')) {
      statusDiv.style.display = 'none';
    }

    event.preventDefault();
  };
})();
