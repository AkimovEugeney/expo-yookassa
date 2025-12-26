import * as React from 'react';

import { ExpoYookassaViewProps } from './ExpoYookassa.types';

export default function ExpoYookassaView(props: ExpoYookassaViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad?.({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
