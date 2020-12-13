import { API } from 'homebridge';
import { DaikinCleanerAccessory } from './accessory'; 

export = (api: API) => {
  api.registerAccessory('DaikinCleaner', DaikinCleanerAccessory)
};
