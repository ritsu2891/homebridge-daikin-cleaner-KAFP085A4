import axios from 'axios';
import { API } from 'homebridge';
import { DaikinCleanerStatus, decodeStatusResponseStr } from './DaikinCleanerStatus';

import { debounce } from 'throttle-debounce';

let ip = 'localhost';
let client = axios.create({
  baseURL: `http://${ip}/`,
});

function setIp(newIp: string) {
  ip = newIp;
  client = axios.create({
    baseURL: `http://${ip}/`,
  });
}

async function getContent(endpoint) {
  const res = await client.get(endpoint);
  return res.data;
}

async function getCleanerState(api: API) {
  return new DaikinCleanerStatus(await getContent('/cleaner/get_control_info'), api);
}

async function setCleanerState(state: DaikinCleanerStatus) {
  console.log(state.getAsDict());
  await client.get('/cleaner/set_control_info', {
    params: state.getAsDict(),
  });
  return;
}

async function getSensorValue() {
  return decodeStatusResponseStr(await getContent('/cleaner/get_sensor_info'));
}

export { setIp, getCleanerState, getSensorValue, setCleanerState };