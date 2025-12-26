import { registerWebModule, NativeModule } from 'expo';

import { ExpoYookassaModuleEvents } from './ExpoYookassa.types';

class ExpoYookassaModule extends NativeModule<ExpoYookassaModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ExpoYookassaModule, 'ExpoYookassaModule');
