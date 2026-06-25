const appModule = require("../artifacts/api-server/dist/app.cjs");

module.exports = appModule.default || appModule;
