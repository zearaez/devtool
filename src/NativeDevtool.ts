import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  multiply(a: number, b: number): number;
  setClipboardString(text: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Devtool');
