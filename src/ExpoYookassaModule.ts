import { NativeModule, requireNativeModule } from 'expo';

import { ExpoYookassaModuleEvents } from './ExpoYookassa.types';

declare class ExpoYookassaModule extends NativeModule<ExpoYookassaModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoYookassaModule>('ExpoYookassa');
