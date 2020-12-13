import { getCleanerState, setCleanerState, getSensorValue } from './daikinCleaner';
import { MODE } from './DaikinCleanerStatus';

async function exec() {
  const state = await getCleanerState();
  // console.log(state);

  state.mode = MODE.MANUAL;
  // console.log(state);
  await setCleanerState(state);

  const sensorVal = await getSensorValue();
  sensorVal.humd;
  // console.log(sensorVal);
}

exec();