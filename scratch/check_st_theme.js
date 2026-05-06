import St from 'gi://St';
import Clutter from 'gi://Clutter';
// We can't easily get the stage in standalone gjs, but we can check the class
console.log('St.Theme keys:', Object.keys(St.Theme.prototype));
