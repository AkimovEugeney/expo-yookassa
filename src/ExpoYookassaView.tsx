import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoYookassaViewProps } from './ExpoYookassa.types';

const NativeView: React.ComponentType<ExpoYookassaViewProps> =
  requireNativeView('ExpoYookassa');

export default function ExpoYookassaView(props: ExpoYookassaViewProps) {
  return <NativeView {...props} />;
}
