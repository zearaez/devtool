import React from 'react';
import { Bubble } from './Bubble';
import { isDev } from '../isDev';

export function DevLoggerUI(): React.JSX.Element | null {
  if (!isDev()) return null;
  return <Bubble />;
}

export default DevLoggerUI;
