const fs = require("fs");
const express = require("express");
const https = require("https");

const app = express();

// FE di public
app.use(express.static("public"));

// keys from mkcert (self signed certificate)
const key = fs.readFileSync("./config/cert.key");
const cert = fs.readFileSync("./config/cert.crt");
const options = { key, cert };
const httpsServer = https.createServer(options, app);

const socketIo = require("socket.io");

const config = require("./config/config");
const createWorkers = require("./createWorkers");
const createWebRtcTransportBothkinds = require("./createWebRtcTransportBothkinds");

const io = socketIo(httpsServer, {
  cors: "*",
});

// Globals
// init workers, it's where our mediasoup workers will live
let workers = null;
// init router
let router = null;
// theProducer will be a global, and whoever produced last (for testing)
let theProducer = null;

// init mediasoup, gets mediasoup ready to use
const initMediaSoup = async () => {
  workers = await createWorkers();
  router = await workers[0].createRouter({
    mediaCodecs: config.routerMediaCodecs,
  });
};

initMediaSoup();

// socket.io listener
io.on("connect", (socket) => {
  console.log("new connection");
  let thisClientProducerTransport = null;
  let thisClientProducer = null;
  let thisClientConsumerTransport = null;
  let thisClientConsumer = null;

  // ack stand for acknowledge, but it is actually a callback function
  // (callback/cb is too generic, which can cause confuse later)
  socket.on("getRouterRtpCapabilities", (ack) => {
    ack(router.rtpCapabilities);
  });
  socket.on("createProducerTransport", async (ack) => {
    const { transport, clientTransportParams } =
      await createWebRtcTransportBothkinds(router);
    thisClientProducerTransport = transport;
    ack(clientTransportParams);
  });
  socket.on("connectProducerTransport", async (dtlsParameters, ack) => {
    // get DTLS info from client, and finish the connection
    try {
      await thisClientProducerTransport.connect(dtlsParameters);
      ack("success");
    } catch (error) {
      console.log(error, "error connectProducerTransport");
      ack("error");
    }
  });
  socket.on("startProducing", async ({ kind, rtpParameters }, ack) => {
    try {
      thisClientProducer = await thisClientProducerTransport.produce({
        kind,
        rtpParameters,
      });
      thisClientProducer.on("transportclose", () => {
        console.log("producer transport closed, just FYI");
        thisClientConsumer?.close();
      });

      theProducer = thisClientProducer;
      ack(thisClientProducer.id);
    } catch (error) {
      console.log(error, "error startProducing");
      ack("error");
    }
  });

  // Consumer \\
  socket.on("createConsumerTransport", async (ack) => {
    const { transport, clientTransportParams } =
      await createWebRtcTransportBothkinds(router);
    thisClientConsumerTransport = transport;
    ack(clientTransportParams);
  });
  socket.on("connectConsumerTransport", async (dtlsParameters, ack) => {
    // get DTLS info from client, and finish the connection
    try {
      await thisClientConsumerTransport.connect(dtlsParameters);
      ack("success");
    } catch (error) {
      console.log(error, "error connectConsumerTransport");
      ack("error");
    }
  });
  socket.on("consumeMedia", async ({ rtpCapabilities }, ack) => {
    // set up clientConsumer and send back.
    // make sure there is a producer, we can't consume without one produce
    if (!theProducer) {
      console.error("No producer!");
      ack("noProducer");
    } else if (
      !router.canConsume({ producerId: theProducer.id, rtpCapabilities })
    ) {
      console.error("No router can consume!");
      ack("cannotConsume");
    } else {
      // we can consume..
      thisClientConsumer = await thisClientConsumerTransport.consume({
        producerId: theProducer.id,
        rtpCapabilities,
        paused: true,
      });
      thisClientConsumer.on("transportclose", () => {
        console.log("consumer transport closed, just FYI");
        thisClientConsumer?.close();
      });

      const consumerParams = {
        producerId: theProducer.id,
        id: thisClientConsumer.id,
        kind: thisClientConsumer.kind,
        rtpParameters: thisClientConsumer.rtpParameters,
      };
      ack(consumerParams);
    }
  });
  socket.on("unpauseConsumer", async (ack) => {
    await thisClientConsumer.resume();
    ack("success");
  });

  // closeAll
  socket.on("closeAll", (ack) => {
    // client has req to close all
    try {
      thisClientConsumerTransport?.close();
      thisClientProducerTransport?.close();
      ack("success");
    } catch (error) {
      ack("closeError");
    }
  });

  // end of socket.io listeners
});

httpsServer.listen(config.port, () => {
  console.log(`Server is running on https://192.168.0.200:${config.port}`);
});
