module.exports = (homebridge) => {
  const requester = require('./lib/Requester.js');
  const exportedTypes = {
    Service: homebridge.hap.Service,
    Characteristic: homebridge.hap.Characteristic,
    Requester: requester,
  };
  const DaikinAirconAccessory = require('./lib/DaikinAirconAccessory.js')(exportedTypes);
  homebridge.registerAccessory('homebridge-daikin-aircon', 'DaikinAircon', DaikinAirconAccessory);
};
