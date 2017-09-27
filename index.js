module.exports = (homebridge) => {
    const exportedTypes = {
        Service: homebridge.hap.Service,
        Characteristic: homebridge.hap.Characteristic,
        Requester: require('./lib/Requester.js')
    };
    const DaikinAirconAccessory = require('./lib/DaikinAirconAccessory.js')(exportedTypes);
    homebridge.registerAccessory('homebridge-daikin-aircon', 'DaikinAircon', DaikinAirconAccessory);
}
