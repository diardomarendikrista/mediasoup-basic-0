// Globals
let socket = null;
let device = null;
let localStream = null;
let producerTransport = null;
let producer = null;
let consumerTransport = null;
let consumer = null;

// connect to server (btn connect)
const initConnect = () => {
  socket = io("https://192.168.0.200:4000");
  connectButton.innerHTML = "Connecting...";
  connectButton.disabled = true;

  addSocketListener(); // keep socket listeners in their own place
};

// btn Create & Load Device
const deviceSetup = async () => {
  // console.log(mediasoupClient);
  device = new mediasoupClient.Device();

  // get routerRtpCapabilities & load to device
  const routerRtpCapabilities = await socket.emitWithAck(
    "getRouterRtpCapabilities"
  );
  await device.load({ routerRtpCapabilities });

  deviceButton.innerHTML = "Device Loaded";
  deviceButton.disabled = true;
  createProdButton.disabled = false;
  createConsButton.disabled = false;
  disconnectButton.disabled = false;
};

const createProducer = async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
  } catch (error) {
    console.error("Error accessing media devices", error);
  }

  // ask the signaling for transport info
  const data = await socket.emitWithAck("createProducerTransport");
  const { id, iceParameters, iceCandidates, dtlsParameters, sctpParameters } =
    data;
  console.log(data, "data");

  // make a transport on the client (producer)!
  const transport = device.createSendTransport({
    id,
    iceParameters,
    iceCandidates,
    dtlsParameters,
    sctpParameters,
  });
  producerTransport = transport;

  // transport connect event will NOT fire until we call transport.produce()
  producerTransport.on(
    "connect",
    async ({ dtlsParameters }, callback, errback) => {
      // connect comes with local dtlsParameters. we need to send thme to the server
      const response = await socket.emitWithAck("connectProducerTransport", {
        dtlsParameters,
      });
      console.log(response, " response");

      if (response === "success") {
        callback(); // call callback simply lets the app know the server succeeded in connection
      } else {
        errback(); // call errback simply lets the app know the server error in connection
      }
    }
  );

  producerTransport.on("produce", async (parameters, callback, errback) => {
    // console.log("Transport produce event has fired!");
    console.log(parameters, "parameters");
    const { kind, rtpParameters } = parameters;
    const response = await socket.emitWithAck("startProducing", {
      kind,
      rtpParameters,
    });
    console.log(response, " response");

    if (response === "error") {
      errback(); // something went wrong when the server tried to produce
      return;
    }
    callback({ id: response });
    // publishButton.disabled = true;
    // createConsButton.disabled = false;
    disconnectButton.disabled = false;
  });

  createProdButton.disabled = true;
  publishButton.disabled = false;
};

const publish = async () => {
  const track = localStream.getVideoTracks()[0];
  procuder = await producerTransport.produce({ track });
};

const createConsumer = async () => {
  // ask the signaling for transport info
  const data = await socket.emitWithAck("createConsumerTransport");
  const { id, iceParameters, iceCandidates, dtlsParameters, sctpParameters } =
    data;
  console.log(data, "data");

  // make a transport on the client (consumer)!
  const transport = device.createRecvTransport({
    id,
    iceParameters,
    iceCandidates,
    dtlsParameters,
    sctpParameters,
  });
  consumerTransport = transport;

  consumerTransport.on("connectionstatechange", (state) => {
    console.log(state, "...connection state change...");
  });
  consumerTransport.on("icegatheringstatechange", (state) => {
    console.log(state, "...ice gathering change...");
  });

  // transport connect event will NOT fire until we call transport.consume()
  consumerTransport.on(
    "connect",
    async ({ dtlsParameters }, callback, errback) => {
      // connect comes with local dtlsParameters. we need to send thme to the server
      const response = await socket.emitWithAck("connectConsumerTransport", {
        dtlsParameters,
      });
      console.log(response, " response");

      if (response === "success") {
        callback(); // call callback simply lets the app know the server succeeded in connection
      } else {
        errback(); // call errback simply lets the app know the server error in connection
      }
    }
  );

  createConsButton.disabled = true;
  consumeButton.disabled = false;
};

// emit consume-media event. will get us back the "stuff" we need to consume, and get video on the screen
const consume = async () => {
  const consumerParams = await socket.emitWithAck("consumeMedia", {
    rtpCapabilities: device.rtpCapabilities,
  });
  if (consumerParams === "noProducer") {
    console.error("No producer!");
    return;
  } else if (consumerParams === "cannotConsume") {
    console.error("No router can consume!");
    return;
  }
  // set up our consumer! and add the video to video tag
  consumer = await consumerTransport.consume(consumerParams);
  const { track } = consumer;

  remoteVideo.srcObject = new MediaStream([track]);
  await socket.emitWithAck("unpauseConsumer");
  console.log(track, "the track is live!");
};

const disconnect = async () => {
  // we want to close everything right now.
  // send message to server, then close here
  const closedResponse = await socket.emitWithAck("closeAll");
  if (closedResponse === "closeError") {
    console.error("Error closing transports");
  }

  // close everything on the client side even error
  producerTransport?.close();
  consumerTransport?.close();

  connectButton.disabled = true;
  deviceButton.disabled = true;
  createProdButton.disabled = false;
  publishButton.disabled = true;
  createConsButton.disabled = false;
  consumeButton.disabled = true;
  disconnectButton.disabled = true;
};

function addSocketListener() {
  socket.on("connect", () => {
    connectButton.innerHTML = "Connected";
    deviceButton.disabled = false;
  });
}
