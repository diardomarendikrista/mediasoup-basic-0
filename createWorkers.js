const os = require("os");
const mediasoup = require("mediasoup");
const totalThreads = os.cpus().length; // max allowed workers
const config = require("./config/config");

const createWorkers = async () =>
  new Promise(async (resolve, reject) => {
    let workers = [];
    for (let i = 0; i < totalThreads; i++) {
      const worker = await mediasoup.createWorker({
        rtcMaxPort: config.workerSettings.rtcMaxPort,
        rtcMinPort: config.workerSettings.rtcMinPort,
        logLevel: config.workerSettings.logLevel,
        logTags: config.workerSettings.logTags,
      });

      worker.on("died", () => {
        console.error(
          "mediasoup worker died, exiting in 2 seconds... [pid:%d]",
          worker.pid
        );
        process.exit(1); // just in case this happened, kill the node program
      });
      workers.push(worker);
    }

    resolve(workers);
  });

module.exports = createWorkers;
