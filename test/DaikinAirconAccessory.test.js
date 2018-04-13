const homebridge = new (require('homebridge/lib/api').API)();

const Service = homebridge.hap.Service;
const Characteristic = homebridge.hap.Characteristic;
const Requester = require('./mock-Requester.js');

const exportedTypes = {
  Service,
  Characteristic,
  Requester,
};
const DaikinAirconAccessory = require('../lib/DaikinAirconAccessory')(exportedTypes);

describe('DaikinAirconAccessory', () => {
  describe('parseResponse()', () => {
    it('should be parsed', () => {
      const result = DaikinAirconAccessory.parseResponse('a=1,b=2');
      expect(result).toEqual({
        a: '1',
        b: '2',
      });
    });
  });

  describe('getActive()', () => {
    it('should be success', () => {
      const accessory = new DaikinAirconAccessory();
      accessory.getActive((error, value) => {
        expect(error).toBeNull();
        expect(value).toBe(Characteristic.Active.INACTIVE);
      });

      Requester.currentPower = '1';
      accessory.getActive((error, value) => {
        expect(error).toBeNull();
        expect(value).toBe(Characteristic.Active.ACTIVE);
      });
    });
  });

  describe('setActive()', () => {
    it('should be active with valid mode', () => {
      const config = {
        coolingHeatingThreshold: 26,
      };
      const accessory = new DaikinAirconAccessory(console.log, config);

      Requester.currentPower = '0';

      // 閾値より高い状態で運転開始
      Requester.currentTemp = '28';
      accessory.setActive(Characteristic.Active.ACTIVE, () => {
        accessory.getActive((error, value) => {
          expect(error).toBeNull();
          expect(value).toBe(Characteristic.Active.ACTIVE);
        });

        // 室温が閾値より高いので冷房
        accessory.getHeaterCoolerState((error, value) => {
          expect(error).toBeNull();
          expect(value).toBe(Characteristic.CurrentHeaterCoolerState.COOLING);
        });
      });

      // 閾値より高い状態で運転開始
      Requester.currentTemp = '20';
      accessory.setActive(Characteristic.Active.ACTIVE, () => {
        accessory.getActive((error, value) => {
          expect(error).toBeNull();
          expect(value).toBe(Characteristic.Active.ACTIVE);
        });

        // 室温が閾値より低いので暖房
        accessory.getHeaterCoolerState((error, value) => {
          expect(error).toBeNull();
          expect(value).toBe(Characteristic.CurrentHeaterCoolerState.HEATING);
        });
      });
    });

    it('should be inactive', () => {
      const config = {
        coolingHeatingThreshold: 26,
      };
      const accessory = new DaikinAirconAccessory(console.log, config);
      Requester.currentPower = '1';

      // 運転停止
      accessory.setActive(Characteristic.Active.INACTIVE, () => {
        accessory.getActive((error, value) => {
          expect(error).toBeNull();
          expect(value).toBe(Characteristic.Active.INACTIVE);
        });
      });
    });
  });
});
