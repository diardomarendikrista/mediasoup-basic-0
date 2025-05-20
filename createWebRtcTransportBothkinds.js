// reusable function for transport producer and consumer
const createWebRtcTransportBothkinds = (router) =>
  new Promise(async (resolve, reject) => {
    const transport = await router.createWebRtcTransport({
      enabledUdp: true,
      enabledTcp: true, // always use UDP first, then fallback to TCP
      preferUdp: true,
      listenInfos: [
        {
          protocol: "udp",
          ip: "0.0.0.0",
          announcedAddress: "192.168.0.200",
        },
        {
          protocol: "tcp",
          ip: "0.0.0.0",
          announcedAddress: "192.168.0.200",
        },
      ],
    });
    const clientTransportParams = {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
    resolve({ transport, clientTransportParams });
  });

module.exports = createWebRtcTransportBothkinds;
