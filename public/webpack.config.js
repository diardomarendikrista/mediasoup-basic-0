// webpack.config.js
const path = require("path");

module.exports = {
  mode: "production", // O 'development' para depurar
  entry: "./src/index.js", // Tu archivo de entrada
  output: {
    path: path.resolve(__dirname, "dist"), // Carpeta de salida
    filename: "mediasoup-client-bundle.js", // Nombre del archivo de salida
  },
};
